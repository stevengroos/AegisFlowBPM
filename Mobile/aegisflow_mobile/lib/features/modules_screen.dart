import 'package:flutter/material.dart';
import '../core/api_client.dart';
import 'cases_screen.dart';

class ModulesScreen extends StatefulWidget {
  const ModulesScreen({super.key});

  @override
  State<ModulesScreen> createState() => _ModulesScreenState();
}

class _ModulesScreenState extends State<ModulesScreen> {
  // 🔥 AHORA TRAEMOS CATEGORÍAS Y MÓDULOS JUNTOS 🔥
  Future<Map<String, dynamic>> _fetchCategoriesAndModules() async {
    final responses = await Future.wait([
      apiClient.get('/modules/categories/'),
      apiClient.get('/modules/'),
    ]);

    final List categories = responses[0].data ?? [];
    final List modules = responses[1].data ?? [];

    // 1. Separamos los módulos "Sueltos" (sin carpeta)
    final looseModules = modules
        .where((m) => m['category_id'] == null)
        .toList();

    // 2. Agrupamos los módulos dentro de sus categorías
    final catsWithModules = categories
        .map((cat) {
          final catModules = modules
              .where((m) => m['category_id'] == cat['id'])
              .toList();
          return {...cat, 'modules': catModules};
        })
        .where((cat) => (cat['modules'] as List).isNotEmpty)
        .toList(); // Ocultar carpetas vacías

    return {
      'looseModules': looseModules,
      'categoriesWithModules': catsWithModules,
    };
  }

  // Mapeo de iconos
  IconData _getIconForString(String? iconName) {
    switch (iconName) {
      case 'box':
        return Icons.inventory_2_outlined;
      case 'users':
        return Icons.people_outline;
      case 'building':
        return Icons.domain;
      case 'folder':
        return Icons.folder_outlined;
      case 'folderOpen':
        return Icons.folder_open_outlined;
      case 'fileText':
        return Icons.description_outlined;
      case 'target':
        return Icons.my_location_outlined;
      case 'briefcase':
        return Icons.business_center_outlined;
      default:
        return Icons.widgets_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Módulos Operativos',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
        ),
      ),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _fetchCategoriesAndModules(),
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          } else if (snapshot.hasError) {
            return Center(child: Text('Error al cargar:\n${snapshot.error}'));
          }

          final data = snapshot.data!;
          final List looseModules = data['looseModules'];
          final List categoriesWithModules = data['categoriesWithModules'];

          if (looseModules.isEmpty && categoriesWithModules.isEmpty) {
            return const Center(
              child: Text(
                'No hay módulos disponibles.',
                style: TextStyle(color: Colors.grey),
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              setState(() {});
            },
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // 1. PINTAR LAS CARPETAS (EXPANSION TILES)
                ...categoriesWithModules.map((cat) {
                  return Card(
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      side: BorderSide(color: Colors.grey.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    // Theme para quitar las líneas feas del acordeón por defecto
                    child: Theme(
                      data: Theme.of(
                        context,
                      ).copyWith(dividerColor: Colors.transparent),
                      child: ExpansionTile(
                        leading: Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(
                            _getIconForString(cat['icon']),
                            color: Colors.amber,
                            size: 24,
                          ),
                        ),
                        title: Text(
                          cat['name'],
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                          ),
                        ),
                        childrenPadding: const EdgeInsets.only(
                          left: 16,
                          right: 8,
                          bottom: 8,
                        ),
                        children: (cat['modules'] as List).map<Widget>((mod) {
                          // Los módulos dentro de la carpeta
                          return ListTile(
                            leading: Icon(
                              _getIconForString(mod['icon']),
                              color: Colors.blueAccent,
                              size: 20,
                            ),
                            title: Text(
                              mod['name'],
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            trailing: const Icon(
                              Icons.chevron_right,
                              size: 16,
                              color: Colors.grey,
                            ),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => CasesScreen(
                                    moduleId: mod['id'],
                                    moduleName: mod['name'],
                                  ),
                                ),
                              );
                            },
                          );
                        }).toList(),
                      ),
                    ),
                  );
                }),

                // Si hay carpetas y módulos sueltos, ponemos un pequeño separador
                if (categoriesWithModules.isNotEmpty && looseModules.isNotEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 16, horizontal: 8),
                    child: Text(
                      'OTROS MÓDULOS',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.grey,
                      ),
                    ),
                  ),

                // 2. PINTAR LOS MÓDULOS SUELTOS
                ...looseModules.map((mod) {
                  return Card(
                    elevation: 0,
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                      side: BorderSide(color: Colors.grey.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => CasesScreen(
                              moduleId: mod['id'],
                              moduleName: mod['name'],
                            ),
                          ),
                        );
                      },
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.blue.withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(
                                _getIconForString(mod['icon']),
                                color: Colors.blueAccent,
                                size: 24,
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: Text(
                                mod['name'],
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                ),
                              ),
                            ),
                            const Icon(Icons.chevron_right, color: Colors.grey),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          );
        },
      ),
    );
  }
}
