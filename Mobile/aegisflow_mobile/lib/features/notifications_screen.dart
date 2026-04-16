import 'package:flutter/material.dart';
import '../core/api_client.dart';
import 'case_detail_screen.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<dynamic> _notifications = [];
  bool _isLoading = true;
  bool _showRead = false; // Toggle para ver solo las nuevas o el historial

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiClient.get('/notifications/');
      setState(() {
        _notifications = response.data ?? [];
      });
    } catch (e) {
      debugPrint("Error cargando notificaciones: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // Marcar una notificación como leída
  Future<void> _markAsRead(int id) async {
    try {
      await apiClient.put('/notifications/$id/read');
      // Actualizamos la UI localmente sin tener que recargar todo de internet
      setState(() {
        final index = _notifications.indexWhere((n) => n['id'] == id);
        if (index != -1) {
          _notifications[index]['is_read'] = true;
        }
      });
    } catch (e) {
      debugPrint("Error marcando como leída: $e");
    }
  }

  // Navegar al caso si la notificación tiene un case_id
  void _handleNotificationTap(Map<String, dynamic> notif) {
    if (notif['is_read'] == false) {
      _markAsRead(notif['id']);
    }

    if (notif['case_id'] != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => CaseDetailScreen(
            caseId: notif['case_id'],
            moduleName: 'Registro Vinculado',
          ),
        ),
      );
    }
  }

  String _getTimeAgo(String? dateString) {
    if (dateString == null) return "Desconocida";
    try {
      final date = DateTime.parse(dateString);
      final diff = DateTime.now().difference(date);
      if (diff.inMinutes < 60) return "Hace ${diff.inMinutes} min";
      if (diff.inHours < 24) return "Hace ${diff.inHours} h";
      if (diff.inDays == 1) return "Hace 1 día";
      return "Hace ${diff.inDays} días";
    } catch (e) {
      return "";
    }
  }

  @override
  Widget build(BuildContext context) {
    // Filtramos según el switch (Mostrar todas o solo no leídas)
    final filteredNotifications = _notifications
        .where((n) => _showRead ? true : n['is_read'] == false)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Alertas',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
        actions: [
          // Botón para alternar entre "Solo nuevas" y "Todas"
          TextButton.icon(
            onPressed: () => setState(() => _showRead = !_showRead),
            icon: Icon(
              _showRead ? Icons.visibility_off : Icons.visibility,
              color: Colors.blueAccent,
              size: 18,
            ),
            label: Text(
              _showRead ? 'Ocultar leídas' : 'Ver historial',
              style: const TextStyle(color: Colors.blueAccent),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchNotifications,
        child: _isLoading && _notifications.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : filteredNotifications.isEmpty
            ? ListView(
                // Usamos un ListView para que funcione el pull-to-refresh
                children: [
                  const SizedBox(height: 150),
                  const Icon(
                    Icons.notifications_off_outlined,
                    size: 80,
                    color: Colors.grey,
                  ),
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      _showRead
                          ? 'No tienes notificaciones.'
                          : '¡Todo al día! No hay notificaciones nuevas.',
                      style: const TextStyle(color: Colors.grey),
                    ),
                  ),
                ],
              )
            : ListView.separated(
                itemCount: filteredNotifications.length,
                separatorBuilder: (context, index) =>
                    Divider(height: 1, color: Colors.grey.withOpacity(0.2)),
                itemBuilder: (context, index) {
                  final notif = filteredNotifications[index];
                  final isRead = notif['is_read'] == true;

                  return Container(
                    // Un ligero fondo azul si no está leída
                    color: isRead
                        ? Colors.transparent
                        : Colors.blue.withOpacity(0.05),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 8,
                      ),
                      leading: Stack(
                        children: [
                          CircleAvatar(
                            backgroundColor: isRead
                                ? Colors.grey.withOpacity(0.2)
                                : Colors.blue.withOpacity(0.2),
                            child: Icon(
                              Icons.notifications,
                              color: isRead ? Colors.grey : Colors.blueAccent,
                            ),
                          ),
                          if (!isRead)
                            Positioned(
                              top: 0,
                              right: 0,
                              child: Container(
                                width: 10,
                                height: 10,
                                decoration: const BoxDecoration(
                                  color: Colors.redAccent,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                        ],
                      ),
                      title: Text(
                        notif['title'] ?? 'Notificación',
                        style: TextStyle(
                          fontWeight: isRead
                              ? FontWeight.normal
                              : FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 4.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              notif['message'] ?? '',
                              style: TextStyle(
                                color: isRead
                                    ? Colors.grey
                                    : Colors.grey.shade300,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              _getTimeAgo(notif['created_at']),
                              style: const TextStyle(
                                fontSize: 11,
                                color: Colors.blueAccent,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      onTap: () => _handleNotificationTap(notif),
                    ),
                  );
                },
              ),
      ),
    );
  }
}
