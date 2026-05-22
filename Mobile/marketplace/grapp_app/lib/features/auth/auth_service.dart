import 'package:dio/dio.dart';
import '../../core/api_client.dart'; // Asumo que aquí está tu config base de Dio y secureStorage

class AuthService {
  // Configuración de la App Marca Blanca
  static const int tenantCompanyId = 4; // Ajusta al ID de tu empresa

  // ==========================================
  // 1. REGISTRO DINÁMICO
  // ==========================================
  Future<bool> register({
    required String email,
    required String password,
    required Map<String, dynamic> dynamicData,
  }) async {
    try {
      final payload = {
        'email': email,
        'password': password,
        'company_id': tenantCompanyId,
        'profile_data': dynamicData,
      };

      final response = await apiClient.post('/mobile/register', data: payload);
      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error de conexión.');
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // ==========================================
  // 2. INICIAR SESIÓN (LOGIN)
  // ==========================================
  Future<bool> login({required String email, required String password}) async {
    try {
      final response = await apiClient.post(
        '/auth/login',
        data: FormData.fromMap({'username': email, 'password': password}),
      );

      if (response.statusCode == 200) {
        final token = response.data['access_token'];
        await secureStorage.write(key: ApiClient.tokenKey, value: token);
        return true;
      }
      return false;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Credenciales incorrectas.',
      );
    } catch (e) {
      throw Exception('Error de red al iniciar sesión.');
    }
  }

  // ==========================================
  // 3. OBTENER PERFIL DEL USUARIO
  // ==========================================
  Future<Map<String, dynamic>> getUserProfile() async {
    try {
      final response = await apiClient.get('/users/me');
      return response.data;
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Error al cargar perfil.');
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // ==========================================
  // 3.5 ACTUALIZAR PERFIL DEL USUARIO
  // ==========================================
  Future<bool> updateUserProfile(Map<String, dynamic> data) async {
    try {
      final response = await apiClient.put(
        '/mobile/users/me',
        data: {'profile_data': data},
      );
      return response.statusCode == 200;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al actualizar perfil.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // ==========================================
  // 3.6 ACTUALIZAR CONTRASEÑA
  // ==========================================
  Future<bool> changePassword(
    String currentPassword,
    String newPassword,
  ) async {
    try {
      final response = await apiClient.put(
        '/mobile/users/me/password',
        data: {
          'current_password': currentPassword,
          'new_password': newPassword,
        },
      );
      return response.statusCode == 200;
    } on DioException catch (e) {
      throw Exception(
        e.response?.data['detail'] ?? 'Error al actualizar contraseña.',
      );
    } catch (e) {
      throw Exception('Error inesperado: $e');
    }
  }

  // ==========================================
  // 4. CERRAR SESIÓN (LOGOUT)
  // ==========================================
  Future<void> logout() async {
    try {
      // Llamada opcional al backend para matar la sesión
      await apiClient.post('/auth/logout');
    } catch (e) {
      // No importa si falla el backend, igual borramos localmente
    } finally {
      await secureStorage.delete(key: ApiClient.tokenKey);
    }
  }
}
