import 'package:flutter/material.dart';
import 'catalog/home_screen.dart';
import 'catalog/activity_screen.dart';
import 'profile/profile_screen.dart';
import 'catalog/market_service.dart';
import 'catalog/publish_screen.dart';
import 'catalog/search_screen.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _currentIndex = 0;

  void _changeTab(int index) {
    setState(() => _currentIndex = index);
  }

  // 🔥 NUEVO MENÚ DE PUBLICACIÓN INTELIGENTE (DIVIDE OFERTAS Y DEMANDAS) 🔥
  void _showPublishOptions(BuildContext context) async {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (ctx) {
        return FutureBuilder<List<dynamic>>(
          // 🔥 Hacemos dos llamadas: 1 para traer catálogos, 1 para traer la config y saber cuál es de Demandas
          future: Future.wait([
            MarketService().getPublishableCatalogs(),
            MarketService().getMobileSettings(),
          ]),
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const SizedBox(
                height: 250,
                child: Center(
                  child: CircularProgressIndicator(color: Colors.black),
                ),
              );
            }

            final data = snapshot.data ?? [[], {}];
            final catalogs = data[0] as List<dynamic>;
            final settings = data[1] as Map<String, dynamic>;
            final demandsModuleId = settings['demands_module_id'];

            if (catalogs.isEmpty) {
              return const SizedBox(
                height: 250,
                child: Center(
                  child: Text(
                    'No tienes permisos para publicar.',
                    style: TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              );
            }

            // 🔥 SEPARAMOS LA LISTA AUTOMÁTICAMENTE 🔥
            final offerCatalogs = catalogs
                .where((c) => c['id'] != demandsModuleId)
                .toList();
            final demandCatalogs = catalogs
                .where((c) => c['id'] == demandsModuleId)
                .toList();

            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).padding.bottom + 24,
                top: 24,
                left: 24,
                right: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade300,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  const Text(
                    '¿QUÉ DESEAS HACER?',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 24),

                  // SECCIÓN 1: VENDER (OFERTAS)
                  if (offerCatalogs.isNotEmpty) ...[
                    const Text(
                      'QUIERO VENDER (Publicar Oferta)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.black45,
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...offerCatalogs.map(
                      (c) => _buildPublishOption(
                        ctx,
                        c,
                        Icons.storefront,
                        'Publicar en tu catálogo de ventas',
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // SECCIÓN 2: COMPRAR (DEMANDAS)
                  if (demandCatalogs.isNotEmpty) ...[
                    const Text(
                      'QUIERO COMPRAR (Publicar Demanda)',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF4F46E5),
                        letterSpacing: 1.5,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...demandCatalogs.map(
                      (c) => _buildPublishOption(
                        ctx,
                        c,
                        Icons.campaign,
                        'Anuncia qué necesitas comprar',
                        isDemand: true,
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }

  // WIDGET AUXILIAR PARA DIBUJAR LAS OPCIONES DEL MENÚ
  Widget _buildPublishOption(
    BuildContext ctx,
    Map<String, dynamic> c,
    IconData icon,
    String subtitle, {
    bool isDemand = false,
  }) {
    final color = isDemand ? const Color(0xFF4F46E5) : Colors.black;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        leading: CircleAvatar(
          backgroundColor: isDemand
              ? const Color(0xFF4F46E5).withOpacity(0.1)
              : const Color(0xFFF5F5F7),
          child: Icon(icon, color: color),
        ),
        title: Text(
          c['name'].toString().toUpperCase(),
          style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        subtitle: Text(
          subtitle,
          style: const TextStyle(fontSize: 12, color: Colors.black54),
        ),
        trailing: Icon(Icons.arrow_forward_ios, size: 14, color: color),
        onTap: () {
          Navigator.pop(ctx);
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) =>
                  PublishScreen(moduleId: c['id'], moduleName: c['name']),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    const double navBarHeight = 70;
    const double navBarFloatGap = 20;
    const double fabSize = 64;

    final EdgeInsets contentPadding = EdgeInsets.only(
      bottom: navBarHeight + navBarFloatGap + 16,
    );

    final List<Widget> screens = [
      Padding(
        padding: contentPadding,
        child: HomeScreen(
          onNavigateToTab: (index) => _changeTab(index), // 🔥 Cambia la pestaña
          onTriggerPublish: () =>
              _showPublishOptions(context), // 🔥 Abre el menú +
        ),
      ),
      Padding(padding: contentPadding, child: const SearchScreen()),
      Padding(padding: contentPadding, child: ActivityScreen()),
      Padding(padding: contentPadding, child: ProfileScreen()),
    ];

    return Scaffold(
      backgroundColor: Colors.white,
      floatingActionButton: null,
      bottomNavigationBar: null,
      body: Stack(
        children: [
          screens[_currentIndex],

          Positioned(
            bottom: navBarFloatGap,
            left: 20,
            right: 20,
            child: Container(
              height: navBarHeight,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(navBarHeight / 2),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.06),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildNavItem(
                    icon: Icons.home_outlined,
                    activeIcon: Icons.home_filled,
                    index: 0,
                  ),
                  _buildNavItem(
                    icon: Icons.manage_search,
                    activeIcon: Icons.manage_search,
                    index: 1,
                  ),
                  const SizedBox(width: fabSize),
                  _buildNavItem(
                    icon: Icons.shopping_bag_outlined,
                    activeIcon: Icons.shopping_bag,
                    index: 2,
                  ),
                  _buildNavItem(
                    icon: Icons.person_outline,
                    activeIcon: Icons.person,
                    index: 3,
                  ),
                ],
              ),
            ),
          ),

          Positioned(
            bottom: navBarFloatGap + (navBarHeight / 2) - (fabSize / 2) + 6,
            left: (MediaQuery.of(context).size.width / 2) - (fabSize / 2),
            child: GestureDetector(
              onTap: () => _showPublishOptions(context),
              child: Container(
                width: fabSize,
                height: fabSize,
                decoration: BoxDecoration(
                  color: Colors.black,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.2),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.add, color: Colors.white, size: 32),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required IconData activeIcon,
    required int index,
  }) {
    final isSelected = _currentIndex == index;
    return GestureDetector(
      onTap: () => _changeTab(index),
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.all(8.0),
        child: Icon(
          isSelected ? activeIcon : icon,
          color: isSelected ? Colors.black : Colors.grey.shade400,
          size: 28,
        ),
      ),
    );
  }
}
