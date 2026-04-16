import 'package:flutter/material.dart';
import 'dashboard_screen.dart';
import 'modules_screen.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'auth/session_timeout_wrapper.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({super.key});

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _selectedIndex = 0;

  // Lista de pantallas a las que navegaremos
  final List<Widget> _pages = [
    const DashboardScreen(),
    const ModulesScreen(),
    const NotificationsScreen(),
    const ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    // 🔥 ENVOLVEMOS TODO CON EL GUARDIÁN 🔥
    return SessionTimeoutWrapper(
      child: Scaffold(
        // <-- Aquí abres el Scaffold
        body: _pages[_selectedIndex],
        bottomNavigationBar: NavigationBar(
          selectedIndex: _selectedIndex,
          onDestinationSelected: (index) {
            setState(() {
              _selectedIndex = index;
            });
          },
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.dashboard_outlined),
              selectedIcon: Icon(Icons.dashboard, color: Colors.blueAccent),
              label: 'Inicio',
            ),
            NavigationDestination(
              icon: Icon(Icons.inventory_2_outlined),
              selectedIcon: Icon(Icons.inventory_2, color: Colors.blueAccent),
              label: 'Módulos',
            ),
            NavigationDestination(
              icon: Icon(Icons.notifications_outlined),
              selectedIcon: Icon(Icons.notifications, color: Colors.blueAccent),
              label: 'Alertas',
            ),
            NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person, color: Colors.blueAccent),
              label: 'Perfil',
            ),
          ],
        ),
      ), // 🔥 ¡ESTE ES EL PARÉNTESIS QUE FALTABA! Cierra el Scaffold
    ); // <-- Y este cierra el SessionTimeoutWrapper
  }
}
