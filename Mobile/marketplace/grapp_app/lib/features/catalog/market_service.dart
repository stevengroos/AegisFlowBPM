import 'package:dio/dio.dart';
import '../../core/api_client.dart';

class MarketService {
  // 1. Obtener la lista de Categorías (Módulos Publicados)
  Future<List<dynamic>> getCatalogs() async {
    try {
      final response = await apiClient.get('/mobile/catalogs');
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al cargar los catálogos.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 2. Traer las ofertas de un módulo específico
  Future<List<dynamic>> getOffers(int moduleId) async {
    try {
      final response = await apiClient.get('/mobile/data/$moduleId');
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al cargar las ofertas.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 3. EJECUTAR LA COMPRA (FLUJO NORMAL) 🔥
  Future<bool> executeBuy({
    required int offerId,
    required int contractModuleId,
    required int contractFormId,
    required double volume,
    required double price,
    Map<String, dynamic>? extraData,
  }) async {
    try {
      final response = await apiClient.post(
        '/mobile/market/buy',
        data: {
          'offer_id': offerId,
          'contract_module_id': contractModuleId,
          'contract_form_id': contractFormId,
          'agreed_volume': volume,
          'agreed_price': price,
          'checkout_data': extraData ?? {},
        },
      );

      return response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al procesar la compra.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 3.5 CUBRIR DEMANDA (FLUJO INVERSO) 🔥
  Future<bool> executeFulfill({
    required int demandId,
    required int contractModuleId,
    required int contractFormId,
    required double volume,
    required double price,
    Map<String, dynamic>? extraData,
  }) async {
    try {
      final response = await apiClient.post(
        '/mobile/market/fulfill',
        data: {
          'demand_id': demandId,
          'contract_module_id': contractModuleId,
          'contract_form_id': contractFormId,
          'agreed_volume': volume,
          'agreed_price': price,
          'checkout_data': extraData ?? {},
        },
      );

      return response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al procesar la cobertura.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 4. OBTENER ESTRUCTURA DEL FORMULARIO PARA PUBLICAR
  Future<Map<String, dynamic>> getFormConfig(int formId) async {
    try {
      final response = await apiClient.get('/mobile/config/form_by_id/$formId');
      return response.data;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al cargar formulario.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 4.5 OBTENER FORMULARIO DE CHECKOUT (COMPRA/COBERTURA)
  Future<Map<String, dynamic>> getCheckoutFormConfig(int formId) async {
    try {
      final response = await apiClient.get('/mobile/config/form_by_id/$formId');
      return response.data;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al cargar formulario de checkout.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 5. CREAR NUEVA PUBLICACIÓN EN AEGISFLOW
  Future<bool> createPublication({
    required int moduleId,
    required int formId,
    required Map<String, dynamic> data,
  }) async {
    try {
      final response = await apiClient.post(
        '/cases/',
        data: {'module_id': moduleId, 'form_id': formId, 'data': data},
      );
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al publicar la oferta.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // 🔥 6. OBTENER CATÁLOGOS DONDE EL USUARIO PUEDE PUBLICAR
  Future<List<dynamic>> getPublishableCatalogs() async {
    try {
      final response = await apiClient.get('/mobile/catalogs/publishable');
      if (response.statusCode == 200) {
        return response.data as List<dynamic>;
      }
      return [];
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ??
            'Error al cargar opciones de publicación.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // ==========================================
  // 🔥 8. WISHLIST / FAVORITOS
  // ==========================================
  Future<Map<String, dynamic>> toggleFavorite(int caseId) async {
    try {
      final response = await apiClient.post(
        '/mobile/users/me/favorites/$caseId',
      );
      return response.data;
    } catch (e) {
      throw Exception('Error al actualizar favoritos');
    }
  }

  Future<List<dynamic>> getFavorites() async {
    try {
      final response = await apiClient.get('/mobile/users/me/favorites');
      return response.data as List<dynamic>;
    } catch (e) {
      throw Exception('Error al cargar favoritos');
    }
  }

  // ==========================================
  // 🔥 9. CENTRO DE OPERACIONES (MI ACTIVIDAD)
  // ==========================================
  Future<List<dynamic>> getMyActivity() async {
    try {
      final response = await apiClient.get('/mobile/users/me/activity');
      return response.data as List<dynamic>;
    } catch (e) {
      throw Exception('Error al cargar historial de operaciones');
    }
  }

  // ==========================================
  // 🔥 10. NOTIFICACIONES
  // ==========================================
  Future<List<dynamic>> getNotifications() async {
    try {
      final response = await apiClient.get('/mobile/users/me/notifications');
      return response.data as List<dynamic>;
    } catch (e) {
      throw Exception('Error al cargar notificaciones');
    }
  }

  Future<void> markNotificationRead(int notifId) async {
    try {
      await apiClient.put('/mobile/users/me/notifications/$notifId/read');
    } catch (e) {
      // Si falla es silencioso
    }
  }

  // ==========================================
  // 🔥 11. CHAT B2B EXTERNO
  // ==========================================
  Future<List<dynamic>> getChatHistory(int caseId) async {
    try {
      final response = await apiClient.get('/mobile/cases/$caseId/chat');
      return response.data as List<dynamic>;
    } catch (e) {
      throw Exception('Error al cargar el historial del chat');
    }
  }

  // ==========================================
  // 🔥 12. CONFIGURACIÓN Y LÍNEA DE TIEMPO B2C
  // ==========================================
  Future<Map<String, dynamic>> getMobileSettings() async {
    try {
      final response = await apiClient.get('/mobile/settings/mobile');
      return response.data as Map<String, dynamic>;
    } catch (e) {
      return {'theme_color': '#000000'};
    }
  }

  Future<List<dynamic>> getTimeline(int caseId) async {
    try {
      final response = await apiClient.get('/mobile/cases/$caseId/timeline');
      return response.data as List<dynamic>;
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> getFormConfigByModule(int moduleId) async {
    try {
      final response = await apiClient.get('/mobile/config/form/$moduleId');
      return response.data;
    } catch (e) {
      throw Exception('Error al cargar formulario del módulo.');
    }
  }
}
