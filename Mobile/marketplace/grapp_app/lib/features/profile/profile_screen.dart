import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../auth/auth_service.dart';
import '../auth/login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final AuthService _authService = AuthService();
  Map<String, dynamic>? _userData;
  bool _isLoading = true;
  bool _isSavingProfile = false;
  bool _isSavingPassword = false;

  final Map<String, dynamic> _editableData = {};

  // 🔥 Controladores para el cambio de contraseña
  final TextEditingController _currentPwdCtrl = TextEditingController();
  final TextEditingController _newPwdCtrl = TextEditingController();
  final TextEditingController _confirmPwdCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _currentPwdCtrl.dispose();
    _newPwdCtrl.dispose();
    _confirmPwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadProfile() async {
    try {
      final data = await _authService.getUserProfile();
      setState(() => _userData = data);
    } catch (e) {
      _showSnackbar(e.toString(), Colors.red);
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveProfileChanges() async {
    if (_editableData.isEmpty) {
      _showSnackbar("No hay cambios en el perfil para guardar", Colors.black87);
      return;
    }

    setState(() => _isSavingProfile = true);
    FocusScope.of(context).unfocus();

    try {
      await _authService.updateUserProfile(_editableData);
      _showSnackbar("¡Perfil actualizado con éxito!", Colors.green);
      _editableData.clear();
    } catch (e) {
      _showSnackbar(e.toString(), Colors.red);
    } finally {
      setState(() => _isSavingProfile = false);
    }
  }

  // 🔥 Función para validar y guardar la contraseña
  Future<void> _savePassword() async {
    final current = _currentPwdCtrl.text;
    final newPwd = _newPwdCtrl.text;
    final confirm = _confirmPwdCtrl.text;

    if (current.isEmpty || newPwd.isEmpty || confirm.isEmpty) {
      _showSnackbar(
        "Por favor, completa todos los campos de contraseña",
        Colors.redAccent,
      );
      return;
    }

    if (newPwd != confirm) {
      _showSnackbar(
        "La nueva contraseña y la confirmación no coinciden",
        Colors.redAccent,
      );
      return;
    }

    setState(() => _isSavingPassword = true);
    FocusScope.of(context).unfocus();

    try {
      await _authService.changePassword(current, newPwd);
      _showSnackbar("¡Contraseña actualizada con éxito!", Colors.green);
      // Limpiamos los campos tras el éxito
      _currentPwdCtrl.clear();
      _newPwdCtrl.clear();
      _confirmPwdCtrl.clear();
    } catch (e) {
      _showSnackbar(e.toString(), Colors.red);
    } finally {
      setState(() => _isSavingPassword = false);
    }
  }

  void _logout(BuildContext context) async {
    await _authService.logout();
    if (!context.mounted) return;
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (route) => false,
    );
  }

  void _showSnackbar(String message, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message, style: const TextStyle(color: Colors.white)),
        backgroundColor: color,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    final bool isActive = _userData?['is_active'] ?? false;
    final Map<String, dynamic> profileData = _userData?['profile_data'] ?? {};

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: const Text(
          'MIS DATOS',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 16,
            letterSpacing: 1.0,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.black))
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isActive)
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      color: Colors.orange.shade100,
                      child: Row(
                        children: [
                          Icon(
                            Icons.pending_actions,
                            color: Colors.orange.shade800,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Cuenta en Revisión. Algunas funciones están limitadas hasta la aprobación de GRAPP.',
                              style: TextStyle(
                                color: Colors.orange.shade900,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const SizedBox(height: 24),

                  // 🔥 BLOQUE 1: DATOS PERSONALES
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 32,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DATOS PERSONALES',
                          style: TextStyle(
                            color: Colors.black38,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 2.0,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildEditableField(
                          'Nombres',
                          'first_name',
                          _userData?['first_name'] ??
                              profileData['first_name'] ??
                              '',
                        ),
                        _buildEditableField(
                          'Apellidos',
                          'last_name',
                          _userData?['last_name'] ??
                              profileData['last_name'] ??
                              '',
                        ),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 24.0),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Correo Electrónico',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 16,
                                  vertical: 16,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.grey.shade100,
                                  borderRadius: BorderRadius.circular(4),
                                  border: Border.all(
                                    color: Colors.grey.shade300,
                                  ),
                                ),
                                child: Text(
                                  _userData?['email'] ?? '',
                                  style: const TextStyle(
                                    fontSize: 15,
                                    color: Colors.black54,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        ...profileData.entries
                            .where(
                              (entry) => ![
                                'first_name',
                                'last_name',
                                'email',
                                'password',
                              ].contains(entry.key),
                            )
                            .map((entry) {
                              return _buildEditableField(
                                entry.key.replaceAll('_', ' ').toUpperCase(),
                                entry.key,
                                entry.value?.toString() ?? '',
                              );
                            }),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEEEEEE),
                              foregroundColor: Colors.black,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(30),
                              ),
                            ),
                            onPressed: _isSavingProfile
                                ? null
                                : _saveProfileChanges,
                            child: _isSavingProfile
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.black,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'GUARDAR PERFIL',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 13,
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // 🔥 BLOQUE 2: SEGURIDAD Y CONTRASEÑA
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 32,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'SEGURIDAD',
                          style: TextStyle(
                            color: Colors.black38,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 2.0,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildPasswordField(
                          'Contraseña Actual',
                          _currentPwdCtrl,
                        ),
                        _buildPasswordField('Nueva Contraseña', _newPwdCtrl),
                        _buildPasswordField(
                          'Confirmar Nueva Contraseña',
                          _confirmPwdCtrl,
                        ),
                        const SizedBox(height: 8),
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFEEEEEE),
                              foregroundColor: Colors.black,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(30),
                              ),
                            ),
                            onPressed: _isSavingPassword ? null : _savePassword,
                            child: _isSavingPassword
                                ? const SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.black,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text(
                                    'ACTUALIZAR CONTRASEÑA',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w900,
                                      fontSize: 13,
                                      letterSpacing: 1.0,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  // 🔥 BLOQUE 3: CERRAR SESIÓN
                  Container(
                    color: Colors
                        .transparent, // Lo dejamos fuera de las tarjetas blancas
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.black,
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(30),
                              ),
                            ),
                            onPressed: () => _logout(context),
                            child: const Text(
                              'CERRAR SESIÓN',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 48),
                ],
              ),
            ),
    );
  }

  // WIDGET: CAMPO EDITABLE NORMAL
  Widget _buildEditableField(String label, String key, String initialValue) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 13,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            initialValue: initialValue,
            onChanged: (val) => _editableData[key] = val,
            style: const TextStyle(
              fontSize: 15,
              color: Colors.black87,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Colors.black, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // WIDGET: CAMPO DE CONTRASEÑA
  Widget _buildPasswordField(String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontWeight: FontWeight.w900,
              fontSize: 13,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            obscureText: true, // 🔥 Oculta el texto con asteriscos
            style: const TextStyle(
              fontSize: 15,
              color: Colors.black87,
              fontWeight: FontWeight.w500,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: Colors.white,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 16,
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(4),
                borderSide: const BorderSide(color: Colors.black, width: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
