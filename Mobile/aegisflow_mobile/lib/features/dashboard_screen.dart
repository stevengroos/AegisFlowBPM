import 'package:flutter/material.dart';
import '../core/api_client.dart';
import 'auth/auth_service.dart';
import 'auth/login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  // 🔥 TRADUCCIÓN DEL PROMISE.ALL DE REACT A DART 🔥
  Future<Map<String, dynamic>> _fetchDashboardData() async {
    // Ejecutamos las 3 peticiones en paralelo para que sea ultra rápido
    final responses = await Future.wait([
      apiClient.get('/users/me'),
      apiClient.get('/cases/'),
      apiClient.get('/modules/'),
    ]);

    final user = responses[0].data;
    final List cases = responses[1].data ?? [];
    final List modules = responses[2].data ?? [];

    // 1. Cálculos de Tarjetas (KPIs)
    final now = DateTime.now();
    final oneWeekAgo = now.subtract(const Duration(days: 7));

    int recentCases = 0;
    for (var c in cases) {
      if (c['created_at'] != null) {
        final createdAt = DateTime.parse(c['created_at']);
        if (createdAt.isAfter(oneWeekAgo)) recentCases++;
      }
    }

    // 2. Última Actividad (Top 5 más recientes)
    cases.sort((a, b) {
      final dateA = DateTime.parse(a['created_at'] ?? now.toIso8601String());
      final dateB = DateTime.parse(b['created_at'] ?? now.toIso8601String());
      return dateB.compareTo(dateA); // Orden descendente (más nuevos primero)
    });

    final top5 = cases.take(5).toList();

    // 3. Unir el nombre del módulo a cada caso
    final recentActivity = top5.map((c) {
      final module = modules.firstWhere(
        (m) => m['id'] == c['module_id'],
        orElse: () => {'name': 'Desconocido'},
      );
      return {...c, 'moduleName': module['name']};
    }).toList();

    // Retornamos un gran diccionario con todo listo para pintar
    return {
      'user': user,
      'stats': {
        'totalCases': cases.length,
        'totalModules': modules.length,
        'recentCases': recentCases,
      },
      'recentActivity': recentActivity,
    };
  }

  void _handleLogout() async {
    await AuthService().logout();
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );
    }
  }

  // Helper para calcular el "Hace X horas"
  String _getTimeAgo(String dateString) {
    final date = DateTime.parse(dateString);
    final diff = DateTime.now().difference(date);

    if (diff.inHours == 0) return "Hace menos de 1 hora";
    if (diff.inHours == 1) return "Hace 1 hora";
    if (diff.inHours < 24) return "Hace ${diff.inHours} horas";
    if (diff.inDays == 1) return "Hace 1 día";
    return "Hace ${diff.inDays} días";
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Centro de Comando',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            tooltip: 'Cerrar Sesión',
            onPressed: _handleLogout,
          ),
        ],
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _fetchDashboardData(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(
              child: Text(
                'Error al cargar datos:\n${snapshot.error}',
                textAlign: TextAlign.center,
              ),
            );
          }

          final data = snapshot.data!;
          final user = data['user'];
          final stats = data['stats'];
          final List recentActivity = data['recentActivity'];

          final firstName = user['first_name'] ?? 'Usuario';
          final email = user['email'] ?? 'Sin correo';
          final initial = firstName.toString().isNotEmpty
              ? firstName[0].toUpperCase()
              : 'U';

          return RefreshIndicator(
            onRefresh: () async {
              setState(() {});
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 🔥 TARJETA DE BIENVENIDA 🔥
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade600, Colors.indigo.shade800],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.blue.withOpacity(0.3),
                        blurRadius: 15,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 32,
                        backgroundColor: Colors.white.withOpacity(0.2),
                        child: Text(
                          initial,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Hola, $firstName 👋',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              email,
                              style: TextStyle(
                                color: Colors.blue.shade100,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
                const Text(
                  'Resumen Global',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),

                // 🔥 3 TARJETAS KPI (GRID) 🔥
                GridView.count(
                  crossAxisCount: 2,
                  shrinkWrap:
                      true, // Permite que el GridView viva dentro del ListView
                  physics:
                      const NeverScrollableScrollPhysics(), // Apaga el scroll interno
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.3, // Proporción ancho/alto
                  children: [
                    _buildKpiCard(
                      'Total Registros',
                      stats['totalCases'].toString(),
                      Icons.folder_copy_outlined,
                      Colors.blue,
                    ),
                    _buildKpiCard(
                      'Módulos Activos',
                      stats['totalModules'].toString(),
                      Icons.layers_outlined,
                      Colors.green,
                    ),
                    _buildKpiCard(
                      'Últimos 7 Días',
                      '+${stats['recentCases']}',
                      Icons.trending_up,
                      Colors.orange,
                    ),
                  ],
                ),

                const SizedBox(height: 32),
                const Text(
                  'Últimos Registros',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 16),

                // 🔥 FEED DE ACTIVIDAD 🔥
                if (recentActivity.isEmpty)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(20),
                      child: Text(
                        "No hay actividad reciente",
                        style: TextStyle(color: Colors.grey),
                      ),
                    ),
                  ),

                ...recentActivity.map((rec) {
                  return Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      side: BorderSide(color: Colors.grey.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: Colors.blue.withOpacity(0.1),
                        child: Text(
                          '#${rec['id']}',
                          style: const TextStyle(
                            color: Colors.blue,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                      ),
                      title: Text(
                        'Nuevo registro en ${rec['moduleName']}',
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                        ),
                      ),
                      subtitle: Text(
                        _getTimeAgo(rec['created_at']),
                        style: const TextStyle(fontSize: 12),
                      ),
                      trailing: const Icon(
                        Icons.chevron_right,
                        color: Colors.grey,
                      ),
                      onTap: () {
                        // Aquí navegaremos al detalle del caso en el futuro
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text("Abriendo caso #${rec['id']}"),
                          ),
                        );
                      },
                    ),
                  );
                }).toList(),

                const SizedBox(height: 24), // Espacio al fondo
              ],
            ),
          );
        },
      ),
    );
  }

  // Widget reutilizable para pintar las tarjetitas
  Widget _buildKpiCard(
    String title,
    String value,
    IconData icon,
    MaterialColor color,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 28),
          const Spacer(),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
