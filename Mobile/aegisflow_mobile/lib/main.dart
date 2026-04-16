import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'features/auth/login_screen.dart'; // 🔥 Importamos el Login

void main() {
  runApp(const ProviderScope(child: AegisFlowApp()));
}

class AegisFlowApp extends StatelessWidget {
  const AegisFlowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'AegisFlow',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blueAccent,
        brightness: Brightness.light,
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: Colors.blueAccent,
        brightness: Brightness.dark,
      ),
      themeMode: ThemeMode.system,
      home: const LoginScreen(), // 🔥 Apuntamos al LoginScreen
    );
  }
}
