import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart'; // 🔥 Importante para kIsWeb

class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  // 🔥 MAGIA: Si es Web usa localhost, si es Android/iOS usa 10.0.2.2
  static const String baseUrl = kIsWeb
      ? 'http://127.0.0.1:8000/api/v1'
      : 'http://10.0.2.2:8000/api/v1';

  static const String tokenKey = 'grapp_b2c_token';

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _secureStorage.read(key: tokenKey);
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            try {
              await _secureStorage.delete(key: tokenKey);
            } catch (_) {}
            debugPrint("🚨 Sesión B2C expirada.");
          }
          return handler.next(e);
        },
      ),
    );
  }
}

final apiClient = ApiClient().dio;
final secureStorage = const FlutterSecureStorage();
