import 'package:dio/dio.dart';
import '../../core/api_client.dart';
import '../../core/constants.dart';

class AuthService {
  // 1. LOGIN NORMAL (Y RESPUESTAS DE MFA)
  Future<bool> login(String email, String password, {String? mfaCode}) async {
    try {
      final Map<String, dynamic> requestData = {
        'username': email,
        'password': password,
      };

      if (mfaCode != null && mfaCode.isNotEmpty) {
        requestData['mfa_code'] = mfaCode;
      }

      final response = await apiClient.post(
        '/auth/login',
        data: requestData,
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );

      if (response.statusCode == 200) {
        final token = response.data['access_token'];
        await secureStorage.write(key: Constants.tokenKey, value: token);
        return true;
      }
      return false;
    } on DioException catch (e) {
      final detail = e.response?.data['detail'];

      // 🔥 Leemos exactamente los códigos que manda tu FastAPI 🔥
      if (detail == "MFA_REQUIRED") throw Exception('MFA_REQUIRED');
      if (detail == "MFA_SETUP_REQUIRED") throw Exception('MFA_SETUP_REQUIRED');

      throw Exception(detail ?? 'Error de conexión. Revisa tu internet.');
    } catch (e) {
      if (e.toString().contains('MFA_')) rethrow;
      throw Exception('Error inesperado: $e');
    }
  }

  // 2. OBTENER EL QR DE CONFIGURACIÓN (Como tu fetchMfaSetupData en React)
  Future<String> getMfaSetupQr(String email, String password) async {
    // A. Pedimos un token temporal
    final requestData = {
      'username': email,
      'password': password,
      'request_mfa_setup_token': 'true',
    };

    final loginRes = await apiClient.post(
      '/auth/login',
      data: requestData,
      options: Options(contentType: Headers.formUrlEncodedContentType),
    );

    // B. Lo guardamos temporalmente para poder llamar a /mfa/setup
    await secureStorage.write(
      key: Constants.tokenKey,
      value: loginRes.data['access_token'],
    );

    // C. Pedimos el QR
    final qrRes = await apiClient.post('/auth/mfa/setup');
    return qrRes.data['qr_code_url'];
  }

  // 3. VERIFICAR LA CONFIGURACIÓN INICIAL
  Future<void> verifyMfaSetup(String code) async {
    try {
      await apiClient.post('/auth/mfa/verify', data: {'code': code});
    } on DioException catch (e) {
      throw Exception(e.response?.data['detail'] ?? 'Código incorrecto');
    }
  }

  Future<void> logout() async {
    await secureStorage.delete(key: Constants.tokenKey);
  }
}
