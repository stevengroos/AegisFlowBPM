import 'package:flutter/material.dart';
import 'package:provider/provider.dart'; // 🔥 Importamos provider
import 'core/theme_provider.dart'; // 🔥 Importamos el cerebro de los colores
import 'features/auth/login_screen.dart';

void main() {
  runApp(
    // 🔥 ENVOLVEMOS LA APP: Ahora el color vivirá en la memoria global
    ChangeNotifierProvider(
      create: (_) => ThemeProvider()..fetchTheme(),
      child: const GrappApp(),
    ),
  );
}

class GrappApp extends StatelessWidget {
  const GrappApp({super.key});

  @override
  Widget build(BuildContext context) {
    // 🔥 ESCUCHAMOS EL COLOR DINÁMICO
    final themeColor = context.watch<ThemeProvider>().themeColor;

    return MaterialApp(
      title: 'GRAPP',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: themeColor,
        ), // 🎨 Adiós verde fijo
        primaryColor: themeColor,
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}
