import 'package:flutter/material.dart';
import '../features/catalog/market_service.dart';

class ThemeProvider extends ChangeNotifier {
  Color _themeColor = Colors.black; // Color por defecto (Brutalista)

  Color get themeColor => _themeColor;

  Future<void> fetchTheme() async {
    try {
      final marketService = MarketService();
      final settings = await marketService.getMobileSettings();
      final hexColor = settings['theme_color']?.toString() ?? '#000000';
      _themeColor = _parseHexColor(hexColor);

      // 🔥 Le avisa a TODA la app que el color cambió 🔥
      notifyListeners();
    } catch (e) {
      debugPrint("Error al cargar el tema global: $e");
    }
  }

  Color _parseHexColor(String hexString) {
    hexString = hexString.toUpperCase().replaceAll('#', '');
    if (hexString.length == 6) {
      hexString = 'FF$hexString'; // Opacidad 100%
    }
    return Color(int.tryParse(hexString, radix: 16) ?? 0xFF000000);
  }
}
