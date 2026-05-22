import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'market_service.dart';
import '../auth/auth_service.dart';

class ChatScreen extends StatefulWidget {
  final int caseId;
  final String title;

  const ChatScreen({super.key, required this.caseId, required this.title});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final MarketService _marketService = MarketService();
  final AuthService _authService = AuthService();
  final TextEditingController _textController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  List<dynamic> _messages = [];
  bool _isLoading = true;
  String _myUserId = '';
  WebSocketChannel? _channel;

  @override
  void initState() {
    super.initState();
    _initChat();
  }

  Future<void> _initChat() async {
    try {
      // 1. Obtenemos el perfil para saber quién soy
      final userData = await _authService.getUserProfile();
      _myUserId = userData['id'].toString();

      // 2. Cargamos el historial de la base de datos
      final history = await _marketService.getChatHistory(widget.caseId);

      setState(() {
        _messages = history;
        _isLoading = false;
      });
      _scrollToBottom();

      // 3. 🔥 CONECTAMOS EL WEBSOCKET 🔥
      // OJO: Usa 127.0.0.1 para Web, o la IP de tu PC si usas móvil físico.
      // Asegúrate de que '/mobile' sea el prefijo correcto de tu router en Python.
      final wsUrl = Uri.parse(
        'ws://127.0.0.1:8000/api/v1/mobile/ws/chat/${widget.caseId}?user_id=$_myUserId',
      );
      _channel = WebSocketChannel.connect(wsUrl);

      // Escuchamos los mensajes entrantes en tiempo real
      _channel!.stream.listen((message) {
        final decodedMessage = jsonDecode(message);
        setState(() {
          _messages.add(decodedMessage);
        });
        _scrollToBottom();
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
      setState(() => _isLoading = false);
    }
  }

  void _sendMessage() {
    if (_textController.text.trim().isEmpty || _channel == null) return;

    // 🔥 MODIFICACIÓN CLAVE: Enviamos JSON con la fuente explícita 'client' 🔥
    final payload = jsonEncode({
      'content': _textController.text.trim(),
      'source': 'client', // Indispensable para que el backend sepa quién habla
    });

    _channel!.sink.add(payload);
    _textController.clear();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _channel?.sink.close(); // Cerramos la conexión al salir
    _textController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: Column(
          children: [
            const Text(
              'SOPORTE GRAPP',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.w900,
                fontSize: 16,
                letterSpacing: 1.0,
              ),
            ),
            Text(
              widget.title.toUpperCase(),
              style: const TextStyle(
                color: Colors.black54,
                fontWeight: FontWeight.w600,
                fontSize: 10,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
        backgroundColor: Colors.white,
        elevation: 1,
        centerTitle: true,
        foregroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.black))
          : Column(
              children: [
                // 💬 ÁREA DE MENSAJES
                Expanded(
                  child: ListView.builder(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: _messages.length,
                    itemBuilder: (context, index) {
                      final msg = _messages[index];
                      // is_from_client = True (Soy yo, la App). False = Backoffice (GRAPP)
                      final isMe = msg['is_from_client'] == true;

                      return Align(
                        alignment: isMe
                            ? Alignment.centerRight
                            : Alignment.centerLeft,
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          constraints: BoxConstraints(
                            maxWidth: MediaQuery.of(context).size.width * 0.75,
                          ),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: isMe ? Colors.black : Colors.white,
                            borderRadius: BorderRadius.only(
                              topLeft: const Radius.circular(16),
                              topRight: const Radius.circular(16),
                              bottomLeft: Radius.circular(isMe ? 16 : 0),
                              bottomRight: Radius.circular(isMe ? 0 : 16),
                            ),
                            border: isMe
                                ? null
                                : Border.all(
                                    color: Colors.grey.shade300,
                                    width: 1,
                                  ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (!isMe) ...[
                                Text(
                                  msg['sender_name'].toString().toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.black38,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                                const SizedBox(height: 4),
                              ],
                              Text(
                                msg['content'],
                                style: TextStyle(
                                  color: isMe ? Colors.white : Colors.black87,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // ✍️ CAJA DE TEXTO (INPUT)
                Container(
                  padding: EdgeInsets.only(
                    left: 16,
                    right: 16,
                    top: 12,
                    bottom: MediaQuery.of(context).padding.bottom + 12,
                  ),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                    border: Border(
                      top: BorderSide(color: Color(0xFFEEEEEE), width: 1),
                    ),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF4F4F4),
                            borderRadius: BorderRadius.circular(24),
                          ),
                          child: TextField(
                            controller: _textController,
                            textInputAction: TextInputAction.send,
                            onSubmitted: (_) => _sendMessage(),
                            decoration: const InputDecoration(
                              hintText: 'Escribe un mensaje...',
                              hintStyle: TextStyle(
                                color: Colors.black38,
                                fontSize: 15,
                              ),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 20,
                                vertical: 14,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: _sendMessage,
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: const BoxDecoration(
                            color: Colors.black,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.send,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }
}
