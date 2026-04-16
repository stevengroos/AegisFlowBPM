import 'package:flutter/material.dart';
import '../core/api_client.dart';

class CaseCommentsWidget extends StatefulWidget {
  final int caseId;
  // 🔥 Recibimos los usuarios para poder mencionarlos
  final List<dynamic> companyUsers;

  const CaseCommentsWidget({
    super.key,
    required this.caseId,
    required this.companyUsers,
  });

  @override
  State<CaseCommentsWidget> createState() => _CaseCommentsWidgetState();
}

class _CaseCommentsWidgetState extends State<CaseCommentsWidget> {
  final TextEditingController _commentController = TextEditingController();
  List<dynamic> _comments = [];
  bool _isLoading = true;

  // Estados para las Menciones
  bool _showMentions = false;
  String _mentionQuery = "";

  @override
  void initState() {
    super.initState();
    _fetchComments();

    // Escuchamos cada vez que el usuario teclea algo
    _commentController.addListener(_onTextChanged);
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  // ==========================================
  // 🔥 LÓGICA DE MENCIONES (@)
  // ==========================================
  void _onTextChanged() {
    final text = _commentController.text;
    final selection = _commentController.selection;
    if (selection.baseOffset == -1) return;

    // Obtenemos el texto justo antes del cursor
    final textBeforeCursor = text.substring(0, selection.baseOffset);
    final words = textBeforeCursor.split(' ');
    final lastWord = words.last;

    // Si la palabra actual empieza con '@', activamos la lista de menciones
    if (lastWord.startsWith('@')) {
      setState(() {
        _showMentions = true;
        _mentionQuery = lastWord
            .substring(1)
            .toLowerCase(); // Lo que va después del @
      });
    } else {
      if (_showMentions) setState(() => _showMentions = false);
    }
  }

  void _insertMention(Map<String, dynamic> user) {
    final text = _commentController.text;
    final selection = _commentController.selection;
    final textBeforeCursor = text.substring(0, selection.baseOffset);
    final textAfterCursor = text.substring(selection.baseOffset);

    final words = textBeforeCursor.split(' ');
    words.removeLast(); // Borramos el pedazo de "@busqueda"

    // Formato exacto que pide tu FastAPI: @[Nombre](id)
    final name = user['first_name'] != null
        ? '${user['first_name']} ${user['last_name'] ?? ''}'.trim()
        : user['email'];
    final mentionString = '@[$name](${user['id']}) ';

    final newTextBefore = words.isEmpty
        ? mentionString
        : '${words.join(' ')} $mentionString';

    _commentController.value = TextEditingValue(
      text: newTextBefore + textAfterCursor,
      selection: TextSelection.collapsed(offset: newTextBefore.length),
    );

    setState(() => _showMentions = false);
  }

  // ==========================================
  // PETICIONES A LA API
  // ==========================================
  Future<void> _fetchComments() async {
    try {
      final response = await apiClient.get('/cases/${widget.caseId}/comments');
      setState(() {
        _comments = response.data ?? [];
        _isLoading = false;
      });
    } catch (e) {
      debugPrint("Error cargando comentarios: $e");
    }
  }

  Future<void> _sendComment() async {
    if (_commentController.text.trim().isEmpty) return;

    final text = _commentController.text;
    _commentController.clear();
    setState(() => _showMentions = false);
    FocusScope.of(context).unfocus();

    try {
      // Enviamos el 'content' con las menciones formateadas
      await apiClient.post(
        '/cases/${widget.caseId}/comments',
        data: {'content': text},
      );
      _fetchComments();
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al enviar mensaje')),
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());

    // Filtramos los usuarios para la cajita de menciones
    final filteredUsers = widget.companyUsers.where((u) {
      final name =
          '${u['first_name'] ?? ''} ${u['last_name'] ?? ''} ${u['email'] ?? ''}'
              .toLowerCase();
      return name.contains(_mentionQuery);
    }).toList();

    return Column(
      children: [
        // LISTA DE MENSAJES
        Expanded(
          child: _comments.isEmpty
              ? const Center(
                  child: Text(
                    "No hay comentarios aún.",
                    style: TextStyle(color: Colors.grey),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16),
                  reverse: true, // Lo más nuevo abajo
                  itemCount: _comments.length,
                  itemBuilder: (context, index) {
                    final comment = _comments[_comments.length - 1 - index];
                    return _buildCommentBubble(comment);
                  },
                ),
        ),

        // 🔥 VENTANA DE MENCIONES FLOTANTE 🔥
        if (_showMentions && filteredUsers.isNotEmpty)
          Container(
            constraints: const BoxConstraints(maxHeight: 150),
            margin: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: Theme.of(context).cardColor,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, -5),
                ),
              ],
            ),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: filteredUsers.length,
              itemBuilder: (context, index) {
                final u = filteredUsers[index];
                final name = u['first_name'] != null
                    ? '${u['first_name']} ${u['last_name'] ?? ''}'
                    : u['email'];
                return ListTile(
                  leading: CircleAvatar(
                    radius: 14,
                    backgroundColor: Colors.blueAccent.withOpacity(0.2),
                    child: Text(
                      name[0].toUpperCase(),
                      style: const TextStyle(
                        fontSize: 12,
                        color: Colors.blueAccent,
                      ),
                    ),
                  ),
                  title: Text(
                    name,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  onTap: () => _insertMention(u),
                );
              },
            ),
          ),

        // INPUT DE TEXTO
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Theme.of(context).cardColor,
            border: Border(
              top: BorderSide(color: Colors.grey.withOpacity(0.2)),
            ),
          ),
          child: SafeArea(
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: InputDecoration(
                      hintText: "Escribe un mensaje...",
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide.none,
                      ),
                      filled: true,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sendComment,
                  icon: const Icon(Icons.send),
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCommentBubble(Map<String, dynamic> comment) {
    // 🔥 FIX: Leemos las llaves correctas de tu backend 🔥
    final String author = comment['user_name'] ?? 'Usuario';
    final String message = comment['content'] ?? '';
    final String date = comment['created_at'] != null
        ? DateTime.parse(
            comment['created_at'],
          ).toLocal().toString().split(' ')[1].substring(0, 5)
        : '';

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                author,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: Colors.blueAccent,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                date,
                style: const TextStyle(fontSize: 10, color: Colors.grey),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.grey.withOpacity(0.1),
              borderRadius: const BorderRadius.only(
                topRight: Radius.circular(16),
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Text(message, style: const TextStyle(fontSize: 14)),
          ),
        ],
      ),
    );
  }
}
