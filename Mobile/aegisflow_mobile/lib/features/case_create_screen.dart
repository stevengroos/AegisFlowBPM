import 'package:flutter/material.dart';
import '../core/api_client.dart';

class CaseCreateScreen extends StatefulWidget {
  final int moduleId;
  final String moduleName;

  const CaseCreateScreen({
    super.key,
    required this.moduleId,
    required this.moduleName,
  });

  @override
  State<CaseCreateScreen> createState() => _CaseCreateScreenState();
}

class _CaseCreateScreenState extends State<CaseCreateScreen> {
  int _step = 1;
  bool _isLoading = false;

  // Datos del Paso 1
  List<dynamic> _forms = [];
  Map<String, dynamic>? _selectedForm;

  // Datos del Paso 2
  List<dynamic> _fields = [];
  List<dynamic> _companyUsers = [];

  // Estado del Formulario
  final _formKey = GlobalKey<FormState>();
  Map<String, dynamic> _formData = {};
  int? _assignedTo;

  @override
  void initState() {
    super.initState();
    _fetchForms();
  }

  // ==========================================
  // PASO 1: TRAER PLANTILLAS
  // ==========================================
  Future<void> _fetchForms() async {
    setState(() => _isLoading = true);
    try {
      final response = await apiClient.get(
        '/forms/',
        queryParameters: {'module_id': widget.moduleId},
      );
      setState(() {
        _forms = response.data ?? [];
      });
      // UX Senior: Si solo hay 1 plantilla, saltamos el paso 1 automáticamente
      if (_forms.length == 1) {
        _handleSelectForm(_forms.first);
      }
    } catch (e) {
      debugPrint("Error cargando plantillas: $e");
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // PASO 2: TRAER CAMPOS AL SELECCIONAR PLANTILLA
  // ==========================================
  Future<void> _handleSelectForm(Map<String, dynamic> form) async {
    setState(() {
      _selectedForm = form;
      _isLoading = true;
      _step = 2;
    });

    try {
      // Traemos los campos y los usuarios en paralelo (como en tu React)
      final responses = await Future.wait([
        apiClient.get(
          '/fields/',
          queryParameters: {'form_id': form['id'], 'include_inactive': false},
        ),
        apiClient.get('/auth/users'),
      ]);

      final List formFields = responses[0].data ?? [];
      final List users = responses[1].data ?? [];

      // Inicializamos el diccionario de datos vacío
      Map<String, dynamic> initialData = {};
      for (var f in formFields) {
        final key = f['api_name'] ?? f['label'];
        if (f['field_type'] == 'checkbox') {
          initialData[key] = false;
        } else {
          initialData[key] = '';
        }
      }

      setState(() {
        _fields = formFields;
        _companyUsers = users;
        _formData = initialData;
      });
    } catch (e) {
      debugPrint("Error cargando estructura: $e");
      setState(() => _step = 1); // Lo devolvemos al paso 1 si falla
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // GUARDAR DATOS EN EL BACKEND
  // ==========================================
  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      await apiClient.post(
        '/cases/',
        data: {
          'form_id': _selectedForm!['id'],
          'module_id': widget.moduleId,
          'data': _formData,
          'assigned_to': _assignedTo,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Registro creado con éxito'),
            backgroundColor: Colors.green,
          ),
        );
        // Cerramos la pantalla y devolvemos "true" para avisar que se creó algo
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error al crear el registro'),
            backgroundColor: Colors.redAccent,
          ),
        );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ==========================================
  // RENDERIZADOR DINÁMICO DE CAMPOS
  // ==========================================
  Widget _buildDynamicField(Map<String, dynamic> field) {
    final String key = field['api_name'] ?? field['label'];
    final bool isRequired = field['required'] == true;
    final String type = field['field_type'];

    // 1. SELECT (Dropdown)
    if (type == 'select') {
      List<String> options = [];
      if (field['options'] is List) {
        options = List<String>.from(field['options'].map((e) => e.toString()));
      } else if (field['options'] is String) {
        options = (field['options'] as String)
            .split(',')
            .map((e) => e.trim())
            .toList();
      }

      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: DropdownButtonFormField<String>(
          decoration: InputDecoration(
            labelText: field['label'] + (isRequired ? ' *' : ''),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          value: _formData[key] == '' ? null : _formData[key],
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: (val) => setState(() => _formData[key] = val),
          validator: isRequired
              ? (v) => v == null || v.isEmpty ? 'Campo requerido' : null
              : null,
        ),
      );
    }

    // 2. CHECKBOX (Switch)
    if (type == 'checkbox') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: SwitchListTile(
          title: Text(field['label'] + (isRequired ? ' *' : '')),
          value: _formData[key] == true,
          onChanged: (val) => setState(() => _formData[key] = val),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade300),
          ),
        ),
      );
    }

    // 3. TEXTAREA (Caja grande)
    if (type == 'textarea') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 16),
        child: TextFormField(
          maxLines: 3,
          decoration: InputDecoration(
            labelText: field['label'] + (isRequired ? ' *' : ''),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
          onChanged: (val) => _formData[key] = val,
          validator: isRequired
              ? (v) => v!.isEmpty ? 'Campo requerido' : null
              : null,
        ),
      );
    }

    // 4. CAMPOS DE TEXTO / NÚMERO / EMAIL COMUNES
    TextInputType keyboardType = TextInputType.text;
    if (type == 'number') keyboardType = TextInputType.number;
    if (type == 'email') keyboardType = TextInputType.emailAddress;
    if (type == 'url') keyboardType = TextInputType.url;

    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        keyboardType: keyboardType,
        decoration: InputDecoration(
          labelText: field['label'] + (isRequired ? ' *' : ''),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        ),
        onChanged: (val) => _formData[key] = val,
        validator: isRequired
            ? (v) => v!.isEmpty ? 'Campo requerido' : null
            : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          _step == 1 ? 'Nueva Entrada' : _selectedForm?['name'] ?? 'Formulario',
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _step == 1
          ? _buildStep1()
          : _buildStep2(),
    );
  }

  Widget _buildStep1() {
    if (_forms.isEmpty) {
      return const Center(
        child: Text(
          "No hay plantillas configuradas.",
          style: TextStyle(color: Colors.grey),
        ),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _forms.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final form = _forms[index];
        return ListTile(
          tileColor: Theme.of(context).cardColor,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: BorderSide(color: Colors.grey.withOpacity(0.2)),
          ),
          leading: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.file_copy, color: Colors.blueAccent),
          ),
          title: Text(
            form['name'] ?? '',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          subtitle: Text(form['description'] ?? 'Usar esta plantilla'),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => _handleSelectForm(form),
        );
      },
    );
  }

  Widget _buildStep2() {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // PROPIETARIO
          DropdownButtonFormField<int>(
            decoration: InputDecoration(
              labelText: "Propietario / Asignado a",
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              prefixIcon: const Icon(Icons.person),
            ),
            value: _assignedTo,
            items: _companyUsers.map((u) {
              final name = u['first_name'] != null
                  ? "${u['first_name']} ${u['last_name'] ?? ''}"
                  : u['email'];
              return DropdownMenuItem<int>(value: u['id'], child: Text(name));
            }).toList(),
            onChanged: (val) => setState(() => _assignedTo = val),
          ),
          const SizedBox(height: 24),

          // CAMPOS DINÁMICOS
          const Text(
            "Información del Registro",
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
          ),
          const SizedBox(height: 16),

          ..._fields.map((f) => _buildDynamicField(f)),

          const SizedBox(height: 32),

          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _handleSubmit,
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: const Text(
                "Guardar Registro",
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
