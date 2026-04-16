import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'constants.dart';
import 'package:flutter/foundation.dart';

class ApiClient {
  late final Dio dio;
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage();

  ApiClient() {
    dio = Dio(
      BaseOptions(
        baseUrl: Constants.baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Agregamos el "Interceptor" (El Guardia de Seguridad)
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // 1. Buscamos el token en la bóveda segura
          final token = await _secureStorage.read(key: Constants.tokenKey);

          // 2. Si hay token, se lo pegamos a la petición
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          // Si el servidor nos dice que el token caducó o hay error 401
          if (e.response?.statusCode == 401) {
            try {
              // Intentamos borrar el token de forma segura
              await _secureStorage.delete(key: Constants.tokenKey);
            } catch (storageError) {
              debugPrint("⚠️ Error menor al limpiar la bóveda: $storageError");
            }
            debugPrint("🚨 Acceso denegado o expirado.");
          }
          return handler.next(e);
        },
      ),
    );
  }
}

// Creamos una instancia global para usarla en toda la app
final apiClient = ApiClient().dio;
final secureStorage = const FlutterSecureStorage();
