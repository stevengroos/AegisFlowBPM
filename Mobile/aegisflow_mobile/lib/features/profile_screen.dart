import 'package:flutter/material.dart';
// import 'package:qr_flutter/qr_flutter.dart'; // Descomenta si instalas qr_flutter
import '../core/api_client.dart';
import 'auth/auth_service.dart';
import 'auth/login_screen.dart';
import 'package:qr_flutter/qr_flutter.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  bool _isLoading = true;
  Map<String, dynamic> _profileData = {};

  // Form controllers para datos personales
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  bool _isSavingProfile = false;

  // Form controllers para contraseña
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  bool _isSavingPassword = false;

  // Estados MFA
  String _mfaStatus = 'IDLE'; // IDLE, SETUP, LOADING
  String _mfaQrUrl = '';
  final _mfaCodeController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchProfile();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    _mfaCodeController.dispose();
    super.dispose();
  }

  Future<void> _fetchProfile() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiClient.get('/users/me');
      final data = response.data;
      setState(() {
        _profileData = data;
        _firstNameController.text = data['first_name'] ?? '';
        _lastNameController.text = data['last_name'] ?? '';
      });
    } catch (e) {
      debugPrint("Error cargando perfil: $e");
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Error al cargar perfil')));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // --- LÓGICA DE ACTUALIZACIÓN ---

  Future<void> _updateProfile() async {
    if (_firstNameController.text.trim().isEmpty ||
        _lastNameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nombre y apellido requeridos')),
      );
      return;
    }
    setState(() => _isSavingProfile = true);
    try {
      await apiClient.put(
        '/auth/users/me',
        data: {
          'first_name': _firstNameController.text.trim(),
          'last_name': _lastNameController.text.trim(),
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Perfil actualizado'),
            backgroundColor: Colors.green,
          ),
        );
        _fetchProfile(); // Recargar para mostrar los datos nuevos en el header
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al actualizar perfil')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingProfile = false);
    }
  }

  Future<void> _updatePassword() async {
    if (_newPasswordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Las contraseñas no coinciden')),
      );
      return;
    }
    if (_newPasswordController.text.length < 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('La contraseña debe tener al menos 6 caracteres'),
        ),
      );
      return;
    }

    setState(() => _isSavingPassword = true);
    try {
      await apiClient.put(
        '/auth/users/me/password',
        data: {
          'current_password': _currentPasswordController.text,
          'new_password': _newPasswordController.text,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Contraseña actualizada'),
            backgroundColor: Colors.green,
          ),
        );
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error. Verifica tu contraseña actual.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSavingPassword = false);
    }
  }

  // --- LÓGICA MFA ---

  Future<void> _startMfaSetup() async {
    setState(() => _mfaStatus = 'LOADING');
    try {
      final res = await apiClient.post('/auth/mfa/setup');
      setState(() {
        _mfaQrUrl = res.data['qr_code_url'];
        _mfaStatus = 'SETUP';
      });
    } catch (e) {
      setState(() => _mfaStatus = 'IDLE');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Error al iniciar MFA')));
      }
    }
  }

  Future<void> _verifyMfaSetup() async {
    if (_mfaCodeController.text.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('El código debe tener 6 dígitos')),
      );
      return;
    }
    setState(() => _mfaStatus = 'LOADING');
    try {
      await apiClient.post(
        '/auth/mfa/verify',
        data: {'code': _mfaCodeController.text},
      );
      setState(() {
        _profileData['is_mfa_enabled'] = true;
        _mfaStatus = 'IDLE';
        _mfaCodeController.clear();
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('MFA Activado exitosamente'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() => _mfaStatus = 'SETUP');
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Código incorrecto')));
      }
    }
  }

  Future<void> _disableMfa() async {
    // Diálogo de confirmación
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Desactivar Doble Factor'),
        content: const Text('¿Estás seguro de que deseas desactivar el MFA?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Desactivar'),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _mfaStatus = 'LOADING');
    try {
      await apiClient.post('/auth/mfa/disable');
      setState(() {
        _profileData['is_mfa_enabled'] = false;
        _mfaStatus = 'IDLE';
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('MFA Desactivado')));
      }
    } catch (e) {
      setState(() => _mfaStatus = 'IDLE');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Error al desactivar MFA')),
        );
      }
    }
  }

  void _logout() async {
    await AuthService().logout();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  // --- UI BUILDERS ---

  Widget _buildSectionHeader(String title, IconData icon, Color iconColor) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0, top: 24.0),
      child: Row(
        children: [
          Icon(icon, color: iconColor),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _profileData.isEmpty) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final name = _profileData['first_name'] != null
        ? '${_profileData['first_name']} ${_profileData['last_name'] ?? ''}'
        : 'Usuario';
    final email = _profileData['email'] ?? 'correo@ejemplo.com';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'U';

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Mi Perfil',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout, color: Colors.redAccent),
            onPressed: _logout,
            tooltip: 'Cerrar Sesión',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // CABECERA PERFIL
          Center(
            child: Column(
              children: [
                CircleAvatar(
                  radius: 40,
                  backgroundColor: Colors.blueAccent.withOpacity(0.1),
                  child: Text(
                    initial,
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      color: Colors.blueAccent,
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  name,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  email,
                  style: const TextStyle(color: Colors.grey, fontSize: 14),
                ),
                const SizedBox(height: 8),
                Chip(
                  label: Text(
                    _profileData['role_name'] ?? 'Usuario',
                    style: const TextStyle(fontSize: 12),
                  ),
                  backgroundColor: Colors.blue.withOpacity(0.1),
                  side: BorderSide.none,
                ),
              ],
            ),
          ),

          const Divider(height: 48),

          // DATOS PERSONALES
          _buildSectionHeader('Datos Personales', Icons.person, Colors.blue),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.withOpacity(0.2)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    controller: _firstNameController,
                    decoration: const InputDecoration(
                      labelText: 'Nombre',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _lastNameController,
                    decoration: const InputDecoration(
                      labelText: 'Apellido',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      onPressed: _isSavingProfile ? null : _updateProfile,
                      child: _isSavingProfile
                          ? const SizedBox(
                              height: 16,
                              width: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Guardar Datos'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // SEGURIDAD / CONTRASEÑA
          _buildSectionHeader('Seguridad', Icons.lock, Colors.amber),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.withOpacity(0.2)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  TextField(
                    controller: _currentPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Contraseña Actual',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _newPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Nueva Contraseña',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _confirmPasswordController,
                    obscureText: true,
                    decoration: const InputDecoration(
                      labelText: 'Confirmar Contraseña',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton(
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.amber,
                      ),
                      onPressed: _isSavingPassword ? null : _updatePassword,
                      child: _isSavingPassword
                          ? const SizedBox(
                              height: 16,
                              width: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text('Actualizar Contraseña'),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // MFA
          _buildSectionHeader(
            'Doble Factor (MFA)',
            Icons.security,
            Colors.purple,
          ),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.withOpacity(0.2)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  if (_profileData['is_mfa_enabled'] == true) ...[
                    const Row(
                      children: [
                        Icon(Icons.check_circle, color: Colors.green),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'El Doble Factor de seguridad está activado.',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    OutlinedButton.icon(
                      onPressed: _mfaStatus == 'LOADING' ? null : _disableMfa,
                      icon: const Icon(
                        Icons.shield_outlined,
                        color: Colors.red,
                      ),
                      label: const Text(
                        'Desactivar MFA',
                        style: TextStyle(color: Colors.red),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Colors.red),
                      ),
                    ),
                  ] else if (_mfaStatus == 'SETUP') ...[
                    const Text(
                      'Escanea el código con tu app autenticadora y escribe los 6 dígitos:',
                    ),
                    const SizedBox(height: 16),
                    // Placeholder para QR si no tienes qr_flutter. Si lo tienes, usa QRCode()
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.grey.shade300),
                        ),
                        child: QrImageView(
                          data:
                              _mfaQrUrl, // 🔥 ¡AQUÍ ESTAMOS USANDO LA VARIABLE! 🔥
                          version: QrVersions.auto,
                          size: 150.0,
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextField(
                      controller: _mfaCodeController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: const InputDecoration(
                        labelText: 'Código de 6 dígitos',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: FilledButton(
                            style: FilledButton.styleFrom(
                              backgroundColor: Colors.purple,
                            ),
                            onPressed: _mfaCodeController.text.length == 6
                                ? _verifyMfaSetup
                                : null,
                            child: const Text('Verificar'),
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton(
                          onPressed: () => setState(() {
                            _mfaStatus = 'IDLE';
                            _mfaCodeController.clear();
                          }),
                          child: const Text('Cancelar'),
                        ),
                      ],
                    ),
                  ] else ...[
                    const Row(
                      children: [
                        Icon(Icons.warning_amber_rounded, color: Colors.orange),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'El Doble Factor está desactivado. Es recomendable activarlo.',
                            style: TextStyle(color: Colors.grey),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: _mfaStatus == 'LOADING'
                          ? null
                          : _startMfaSetup,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.purple,
                      ),
                      icon: const Icon(Icons.smartphone),
                      label: const Text('Activar MFA'),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}
