import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart'; // 🔥 Importamos el GPS

class RegisterScreen extends StatefulWidget {
  final int companyId; // El ID de la empresa (Ej: 1)

  const RegisterScreen({super.key, required this.companyId});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  // Configuración de la API (Ajusta la IP si usas emulador iOS o dispositivo físico)
  final String apiBaseUrl = kIsWeb
      ? 'http://localhost:8000/api/v1/mobile'
      : 'http://10.0.2.2:8000/api/v1/mobile';

  bool _isLoadingConfig = true;
  bool _isSubmitting = false;
  String? _errorMessage;

  List<dynamic> _wizardSteps = [];
  int _currentStep = 0;
  final PageController _pageController = PageController();

  // Aquí guardaremos las respuestas del usuario
  final Map<String, dynamic> _formData = {};

  // Claves para el correo y contraseña (necesarios para el login posterior)
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  // 🔥 NUEVO: Controlador para confirmar y variables para el "Ojo"
  final TextEditingController _confirmPasswordController =
      TextEditingController();
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  @override
  void initState() {
    super.initState();
    _fetchRegistrationConfig();
  }

  Future<void> _fetchRegistrationConfig() async {
    try {
      final response = await http.get(
        Uri.parse(
          '$apiBaseUrl/config/registration?company_id=${widget.companyId}',
        ),
      );

      if (response.statusCode == 200) {
        setState(() {
          _wizardSteps = jsonDecode(utf8.decode(response.bodyBytes));
          _isLoadingConfig = false;
        });
      } else {
        setState(() {
          _errorMessage = "Error al cargar el formulario de registro.";
          _isLoadingConfig = false;
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = "Error de conexión con el servidor.";
        _isLoadingConfig = false;
      });
    }
  }

  bool _validateCurrentStep() {
    if (_currentStep == 0) {
      if (_emailController.text.isEmpty ||
          !_emailController.text.contains('@')) {
        _showSnackBar("Ingresa un correo electrónico válido.");
        return false;
      }
      if (_passwordController.text.length < 6) {
        _showSnackBar("La contraseña debe tener al menos 6 caracteres.");
        return false;
      }
      // 🔥 NUEVO: Validar que las contraseñas coincidan
      if (_passwordController.text != _confirmPasswordController.text) {
        _showSnackBar("Las contraseñas no coinciden.");
        return false;
      }
    } else {
      // Validamos los campos dinámicos del paso actual (desfasado por el paso de credenciales)
      final stepConfig = _wizardSteps[_currentStep - 1];
      final fields = stepConfig['fields'] as List<dynamic>;

      for (var field in fields) {
        if (field['required'] == true) {
          final value = _formData[field['api_name']];
          if (value == null || value.toString().trim().isEmpty) {
            _showSnackBar("El campo '${field['label']}' es obligatorio.");
            return false;
          }
        }
      }
    }
    return true;
  }

  void _showSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        backgroundColor: Colors.redAccent,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _nextStep() {
    if (_validateCurrentStep()) {
      FocusScope.of(context).unfocus(); // Ocultar teclado
      if (_currentStep < _wizardSteps.length) {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 400),
          curve: Curves.easeInOut,
        );
        setState(() => _currentStep++);
      } else {
        _submitRegistration();
      }
    }
  }

  void _previousStep() {
    FocusScope.of(context).unfocus();
    if (_currentStep > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
      setState(() => _currentStep--);
    } else {
      Navigator.pop(context);
    }
  }

  Future<void> _submitRegistration() async {
    setState(() => _isSubmitting = true);

    try {
      final payload = {
        "email": _emailController.text.trim(),
        "password": _passwordController.text,
        "company_id": widget.companyId,
        "profile_data": _formData,
      };

      final response = await http.post(
        Uri.parse('$apiBaseUrl/register'),
        headers: {"Content-Type": "application/json"},
        body: jsonEncode(payload),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        // ÉXITO
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: const RoundedRectangleBorder(
              borderRadius: BorderRadius.zero,
            ), // Estilo Gymshark
            title: const Text(
              "SOLICITUD ENVIADA",
              style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1),
            ),
            content: const Text(
              "Tu cuenta está en proceso de revisión. Te notificaremos cuando el equipo de GRAPP valide tus datos.",
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx); // Cierra modal
                  Navigator.pop(context); // Vuelve al login
                },
                child: const Text(
                  "ENTENDIDO",
                  style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        );
      } else {
        final errorData = jsonDecode(response.body);
        _showSnackBar(errorData['detail'] ?? "Error al registrar la cuenta.");
      }
    } catch (e) {
      _showSnackBar("Error de conexión al enviar la solicitud.");
    } finally {
      setState(() => _isSubmitting = false);
    }
  }

  // 🔥 WIDGETS DE CAMPOS DINÁMICOS (ESTÉTICA MINIMALISTA) 🔥
  Widget _buildDynamicField(Map<String, dynamic> field) {
    final String apiName = field['api_name'];
    final String label = field['label'] + (field['required'] ? ' *' : '');
    final String type = field['type'];

    if (type == 'select') {
      final options = (field['options'] as List<dynamic>)
          .map((e) => e.toString())
          .toList();
      return Padding(
        padding: const EdgeInsets.only(bottom: 24.0),
        child: DropdownButtonFormField<String>(
          value: _formData[apiName],
          decoration: _buildInputDecoration(label),
          dropdownColor: Theme.of(context).scaffoldBackgroundColor,
          icon: const Icon(Icons.keyboard_arrow_down, color: Colors.black),
          items: options
              .map(
                (opt) => DropdownMenuItem(
                  value: opt,
                  child: Text(
                    opt,
                    style: const TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              )
              .toList(),
          onChanged: (val) => setState(() => _formData[apiName] = val),
        ),
      );
    }

    if (type == 'checkbox') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 24.0),
        child: CheckboxListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(
            label,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
          ),
          value: _formData[apiName] == true || _formData[apiName] == "true",
          activeColor: Colors.black,
          checkColor: Colors.white,
          onChanged: (val) => setState(() => _formData[apiName] = val),
          controlAffinity: ListTileControlAffinity.leading,
        ),
      );
    }

    // 🔥 NUEVO: RENDERIZADOR DE GEOLOCALIZACIÓN (HITO 8) 🔥
    if (type == 'map') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 24.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              child: TextFormField(
                readOnly: true, // El usuario no lo escribe, lo llena el GPS
                controller: TextEditingController(
                  text: _formData[apiName]?.toString() ?? '',
                ),
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  fontSize: 14,
                  color: Colors.blueAccent,
                ),
                decoration: _buildInputDecoration(label),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              height: 48,
              decoration: BoxDecoration(
                color:
                    Colors.black, // O tu themeColor si ya aplicaste el Provider
                borderRadius: BorderRadius.circular(8),
              ),
              child: IconButton(
                icon: const Icon(Icons.my_location, color: Colors.white),
                onPressed: () async {
                  FocusScope.of(context).unfocus(); // Ocultamos el teclado

                  // 1. Validamos permisos
                  bool serviceEnabled =
                      await Geolocator.isLocationServiceEnabled();
                  if (!serviceEnabled) {
                    _showSnackBar("Por favor, activa el GPS del teléfono.");
                    return;
                  }

                  LocationPermission permission =
                      await Geolocator.checkPermission();
                  if (permission == LocationPermission.denied) {
                    permission = await Geolocator.requestPermission();
                    if (permission == LocationPermission.denied) {
                      _showSnackBar("Permiso de ubicación denegado.");
                      return;
                    }
                  }

                  // 2. Obtenemos la ubicación y actualizamos el formulario
                  _showSnackBar("Buscando satélites... 🛰️");
                  Position pos = await Geolocator.getCurrentPosition(
                    desiredAccuracy: LocationAccuracy.high,
                  );

                  setState(() {
                    _formData[apiName] = '${pos.latitude}, ${pos.longitude}';
                  });
                },
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 24.0),
      child: TextFormField(
        initialValue: _formData[apiName]?.toString() ?? '',
        keyboardType: type == 'number'
            ? TextInputType.number
            : type == 'email'
            ? TextInputType.emailAddress
            : TextInputType.text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        decoration: _buildInputDecoration(label),
        onChanged: (val) => _formData[apiName] = val,
      ),
    );
  }

  // 🔥 NUEVO: Ahora acepta un widget 'suffixIcon' opcional
  InputDecoration _buildInputDecoration(String label, {Widget? suffixIcon}) {
    return InputDecoration(
      labelText: label.toUpperCase(),
      labelStyle: const TextStyle(
        color: Colors.grey,
        fontWeight: FontWeight.bold,
        fontSize: 12,
        letterSpacing: 1.2,
      ),
      floatingLabelBehavior: FloatingLabelBehavior.always,
      enabledBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.grey.shade300, width: 2),
      ),
      focusedBorder: const UnderlineInputBorder(
        borderSide: BorderSide(color: Colors.black, width: 3),
      ),
      contentPadding: const EdgeInsets.symmetric(vertical: 8),
      suffixIcon: suffixIcon, // 🔥 Inyectamos el ícono aquí
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingConfig) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator(color: Colors.black)),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 60, color: Colors.red),
              const SizedBox(height: 16),
              Text(
                _errorMessage!,
                style: const TextStyle(fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),
      );
    }

    // Paso 0 (Credenciales) + Pasos dinámicos del API
    final int totalSteps = _wizardSteps.length + 1;
    final double progress = (_currentStep + 1) / totalSteps;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // BARRA SUPERIOR MINIMALISTA
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 16.0,
                vertical: 12.0,
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios, color: Colors.black),
                    onPressed: _previousStep,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                  const SizedBox(width: 24),
                  Expanded(
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.grey.shade200,
                      valueColor: const AlwaysStoppedAnimation<Color>(
                        Colors.black,
                      ),
                      minHeight: 4,
                    ),
                  ),
                  const SizedBox(width: 24),
                  Text(
                    "${_currentStep + 1} / $totalSteps",
                    style: const TextStyle(
                      fontWeight: FontWeight.w900,
                      fontSize: 12,
                      letterSpacing: 1,
                    ),
                  ),
                ],
              ),
            ),

            // CONTENIDO DEL WIZARD
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                physics:
                    const NeverScrollableScrollPhysics(), // Evita el swipe manual
                itemCount: totalSteps,
                itemBuilder: (context, index) {
                  // PASO 0: CREDENCIALES FIJAS
                  if (index == 0) {
                    return ListView(
                      padding: const EdgeInsets.all(32.0),
                      children: [
                        const Text(
                          "CREA TU",
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey,
                            letterSpacing: 2,
                          ),
                        ),
                        const Text(
                          "CUENTA",
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                            height: 1.1,
                            letterSpacing: -1,
                          ),
                        ),
                        const SizedBox(height: 40),
                        TextFormField(
                          controller: _emailController,
                          keyboardType: TextInputType.emailAddress,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                          decoration: _buildInputDecoration(
                            'Correo Electrónico *',
                          ),
                        ),
                        const SizedBox(height: 24),
                        // CAMPO CONTRASEÑA CON OJO
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                          decoration: _buildInputDecoration(
                            'Contraseña *',
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                color: Colors.grey,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),

                        // 🔥 NUEVO: CAMPO CONFIRMAR CONTRASEÑA CON OJO
                        TextFormField(
                          controller: _confirmPasswordController,
                          obscureText: _obscureConfirmPassword,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 16,
                          ),
                          decoration: _buildInputDecoration(
                            'Confirmar Contraseña *',
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscureConfirmPassword
                                    ? Icons.visibility_off
                                    : Icons.visibility,
                                color: Colors.grey,
                              ),
                              onPressed: () {
                                setState(() {
                                  _obscureConfirmPassword =
                                      !_obscureConfirmPassword;
                                });
                              },
                            ),
                          ),
                        ),
                      ],
                    );
                  }

                  // PASOS DINÁMICOS DESDE EL BACKEND
                  final stepConfig = _wizardSteps[index - 1];
                  final fields = stepConfig['fields'] as List<dynamic>;

                  return ListView(
                    padding: const EdgeInsets.all(32.0),
                    children: [
                      Text(
                        "PASO ${index + 1}",
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey,
                          letterSpacing: 2,
                        ),
                      ),
                      Text(
                        (stepConfig['title'] as String).toUpperCase(),
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                          height: 1.1,
                          letterSpacing: -1,
                        ),
                      ),
                      const SizedBox(height: 40),
                      ...fields.map((f) => _buildDynamicField(f)).toList(),
                    ],
                  );
                },
              ),
            ),

            // BOTÓN INFERIOR ESTILO BRUTALISTA
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: SizedBox(
                width: double.infinity,
                height: 60,
                child: ElevatedButton(
                  onPressed: _isSubmitting ? null : _nextStep,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.black,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.zero,
                    ), // Cero bordes redondeados
                  ),
                  child: _isSubmitting
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          _currentStep == totalSteps - 1
                              ? "SOLICITAR ACCESO"
                              : "SIGUIENTE",
                          style: const TextStyle(
                            fontWeight: FontWeight.w900,
                            fontSize: 16,
                            letterSpacing: 2,
                          ),
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
