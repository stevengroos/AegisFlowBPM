import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/api_client.dart';
import 'auth_service.dart';
import 'login_screen.dart';

class SessionTimeoutWrapper extends StatefulWidget {
  final Widget child;

  const SessionTimeoutWrapper({super.key, required this.child});

  @override
  State<SessionTimeoutWrapper> createState() => _SessionTimeoutWrapperState();
}

class _SessionTimeoutWrapperState extends State<SessionTimeoutWrapper> {
  Timer? _inactivityTimer;
  Timer? _countdownTimer;

  int _timeoutMinutes = 15; // Valor por defecto
  int _countdownSeconds = 60;
  bool _isWarningVisible = false;

  // Permite actualizar solo el número del contador sin recargar toda la pantalla
  final ValueNotifier<int> _countdownNotifier = ValueNotifier<int>(60);

  @override
  void initState() {
    super.initState();
    _fetchSessionConfig();
    _resetInactivityTimer();
  }

  // 1. Preguntamos al backend cuánto tiempo de inactividad permite esta empresa
  Future<void> _fetchSessionConfig() async {
    try {
      final response = await apiClient.get('/auth/session-config');
      if (response.data != null &&
          response.data['inactivity_timeout_minutes'] != null) {
        setState(
          () => _timeoutMinutes = response.data['inactivity_timeout_minutes'],
        );
        _resetInactivityTimer();
      }
    } catch (e) {
      debugPrint("Usando tiempo de inactividad por defecto (15 min)");
    }
  }

  // 2. Este método se dispara CADA VEZ que el usuario toca la pantalla
  void _handleUserInteraction([_]) {
    if (!_isWarningVisible) {
      _resetInactivityTimer(); // Reiniciamos el reloj silenciosamente
    }
  }

  void _resetInactivityTimer() {
    _inactivityTimer?.cancel();
    _countdownTimer?.cancel();

    // Calculamos cuánto tiempo inactivo permitimos antes de avisar (1 min antes del límite)
    int warningDelayMinutes = _timeoutMinutes > 1 ? _timeoutMinutes - 1 : 0;
    int warningDelaySeconds = _timeoutMinutes > 1 ? 0 : 45;

    _inactivityTimer = Timer(
      Duration(minutes: warningDelayMinutes, seconds: warningDelaySeconds),
      _showWarningDialog,
    );
  }

  // 3. ¡PELIGRO! Lanzamos el Modal Rojo
  void _showWarningDialog() {
    if (!mounted) return;

    setState(() {
      _isWarningVisible = true;
      _countdownSeconds = 60;
    });
    _countdownNotifier.value = 60;

    // Arranca el segundero de la muerte
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdownSeconds > 1) {
        _countdownSeconds--;
        _countdownNotifier.value = _countdownSeconds;
      } else {
        // Se acabó el tiempo.
        timer.cancel();
        _logout(isTimeout: true);
      }
    });

    showDialog(
      context: context,
      barrierDismissible: false, // No se puede cerrar tocando afuera
      builder: (context) {
        return PopScope(
          canPop:
              false, // Evitar que lo cierren con el botón físico "Atrás" de Android
          child: Dialog(
            backgroundColor: Colors.transparent,
            elevation: 0,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // CABECERA ROJA
                  Container(
                    color: Colors.redAccent,
                    padding: const EdgeInsets.all(24),
                    width: double.infinity,
                    child: Column(
                      children: [
                        const Icon(
                          Icons.warning_amber_rounded,
                          size: 56,
                          color: Colors.white,
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          "Tu sesión está a punto de expirar",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          "Por políticas de seguridad, cerraremos tu sesión por inactividad en:",
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.white70, fontSize: 13),
                        ),
                        const SizedBox(height: 16),
                        // El contador que se actualiza cada segundo
                        ValueListenableBuilder<int>(
                          valueListenable: _countdownNotifier,
                          builder: (context, value, child) {
                            return Text(
                              "$value seg",
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 48,
                                fontWeight: FontWeight.bold,
                              ),
                            );
                          },
                        ),
                      ],
                    ),
                  ),
                  // BOTONES
                  Container(
                    padding: const EdgeInsets.all(24),
                    color: Theme.of(context).cardColor,
                    child: Column(
                      children: [
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.green,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            onPressed: _stayLoggedIn,
                            icon: const Icon(Icons.check_circle),
                            label: const Text(
                              "Seguir Conectado",
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: OutlinedButton.icon(
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.grey,
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                            ),
                            onPressed: () => _logout(),
                            icon: const Icon(Icons.logout),
                            label: const Text(
                              "Cerrar Sesión Ahora",
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  void _stayLoggedIn() {
    _countdownTimer?.cancel();
    Navigator.of(context, rootNavigator: true).pop(); // Cierra el modal
    setState(() => _isWarningVisible = false);
    _resetInactivityTimer();
  }

  void _logout({bool isTimeout = false}) async {
    _inactivityTimer?.cancel();
    _countdownTimer?.cancel();

    if (_isWarningVisible) {
      Navigator.of(
        context,
        rootNavigator: true,
      ).pop(); // Cierra el modal si está abierto
    }

    await AuthService().logout(); // Destruye el token

    if (mounted) {
      if (isTimeout) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sesión cerrada por inactividad'),
            backgroundColor: Colors.orange,
          ),
        );
      }
      // Navegamos al login y destruimos todo el historial de pantallas
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  void dispose() {
    _inactivityTimer?.cancel();
    _countdownTimer?.cancel();
    _countdownNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 🔥 EL RADAR INVISIBLE 🔥
    return Listener(
      onPointerDown: _handleUserInteraction, // Al tocar
      onPointerMove: _handleUserInteraction, // Al deslizar
      onPointerUp: _handleUserInteraction, // Al soltar
      behavior: HitTestBehavior
          .translucent, // Atrapa los toques en toda la pantalla sin bloquearlos
      child: widget.child, // Aquí adentro vive tu MainLayout
    );
  }
}
