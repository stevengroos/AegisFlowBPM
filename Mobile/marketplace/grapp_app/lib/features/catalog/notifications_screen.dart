import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'market_service.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final MarketService _marketService = MarketService();
  List<dynamic> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    try {
      final data = await _marketService.getNotifications();
      setState(() => _notifications = data);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _markAsRead(int index, int notifId, bool isRead) async {
    if (isRead) return; // Si ya está leída, no hacemos nada

    // 1. Actualización optimista (UI rápida)
    setState(() {
      _notifications[index]['is_read'] = true;
    });

    // 2. Avisamos al backend en segundo plano
    await _marketService.markNotificationRead(notifId);
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'NOTIFICACIONES',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 16,
            letterSpacing: 1.0,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        foregroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.black))
          : _notifications.isEmpty
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(
                    Icons.notifications_off_outlined,
                    color: Colors.black12,
                    size: 80,
                  ),
                  SizedBox(height: 16),
                  Text(
                    'NO TIENES NOTIFICACIONES',
                    style: TextStyle(
                      color: Colors.black38,
                      fontSize: 14,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.0,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _loadNotifications,
              color: Colors.white,
              backgroundColor: Colors.black,
              child: ListView.separated(
                itemCount: _notifications.length,
                separatorBuilder: (context, index) =>
                    const Divider(color: Color(0xFFEEEEEE), height: 1),
                itemBuilder: (context, index) {
                  final notif = _notifications[index];
                  final bool isRead = notif['is_read'] ?? false;
                  final String dateStr = notif['created_at'].toString().split(
                    'T',
                  )[0];

                  return InkWell(
                    onTap: () => _markAsRead(index, notif['id'], isRead),
                    child: Container(
                      color: isRead
                          ? Colors.white
                          : const Color(
                              0xFFF4F8FB,
                            ), // Fondo sutil azulado si no está leída
                      padding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 20,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Ícono
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEEEEE),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.notifications_active,
                              color: Colors.black54,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 16),

                          // Textos
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        notif['title'].toString().toUpperCase(),
                                        style: TextStyle(
                                          fontWeight: isRead
                                              ? FontWeight.bold
                                              : FontWeight.w900,
                                          fontSize: 13,
                                          color: Colors.black,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Text(
                                      dateStr,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: Colors.black38,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  notif['message'] ?? '',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: isRead
                                        ? Colors.black54
                                        : Colors.black87,
                                    height: 1.4,
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Puntito azul si no está leído
                          if (!isRead)
                            Padding(
                              padding: const EdgeInsets.only(left: 12, top: 4),
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(
                                  color: Colors.blueAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
