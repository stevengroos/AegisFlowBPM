import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../core/api_client.dart';
import 'case_comments_widget.dart'; // 🔥 Importamos el chat
import 'package:url_launcher/url_launcher.dart'; // 🔥 Para abrir la firma
import 'dart:convert';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:flutter/foundation.dart'
    show kIsWeb; // 🔥 Agrega esto a tus imports

class CaseDetailScreen extends StatefulWidget {
  final int caseId;
  final String moduleName;

  const CaseDetailScreen({
    super.key,
    required this.caseId,
    required this.moduleName,
  });

  @override
  State<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends State<CaseDetailScreen> {
  bool _isLoading = true;
  bool _isEditing = false; // 🔥 Nuevo estado para edición
  bool _isSaving = false;
  WebViewController? _webViewController;

  Map<String, dynamic>? _caseData;
  List<dynamic> _fields = [];
  List<dynamic> _sections = [];
  List<dynamic> _statuses = [];
  List<dynamic> _transitions = [];
  List<dynamic> _companyUsers = [];
  List<dynamic> _history = [];

  // Estado temporal de edición
  Map<String, dynamic> _editFormData = {};
  int? _editAssignedTo;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final caseRes = await apiClient.get('/cases/${widget.caseId}');
      final currentCase = caseRes.data;

      final responses = await Future.wait([
        apiClient.get(
          '/fields/',
          queryParameters: {'module_id': currentCase['module_id']},
        ),
        apiClient.get(
          '/fields/sections',
          queryParameters: {'form_id': currentCase['form_id']},
        ),
        apiClient.get('/statuses/'),
        apiClient.get('/transitions/'),
        apiClient.get('/auth/users'),
        apiClient
            .get('/cases/${widget.caseId}/history')
            .catchError(
              (e) => Response(requestOptions: RequestOptions(), data: []),
            ),
      ]);

      setState(() {
        _caseData = currentCase;
        _fields = responses[0].data ?? [];
        _sections = responses[1].data ?? [];
        _statuses = responses[2].data ?? [];
        _transitions = responses[3].data ?? [];
        _companyUsers = responses[4].data ?? [];
        _history = responses[5].data ?? [];

        // Sincronizamos los datos de edición con los reales
        _editFormData = Map<String, dynamic>.from(currentCase['data'] ?? {});
        _editAssignedTo = currentCase['assigned_to'];
      });
    } catch (e) {
      debugPrint("Error: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveChanges() async {
    setState(() => _isSaving = true);
    try {
      await apiClient.put(
        '/cases/${widget.caseId}',
        data: {'data': _editFormData, 'assigned_to': _editAssignedTo},
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Cambios guardados'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() => _isEditing = false);
      _fetchData(); // Recargamos para ver los cambios reflejados
    } catch (e) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Error al guardar cambios')));
    } finally {
      setState(() => _isSaving = false);
    }
  }

  Future<void> _changeStatus(int newStatusId) async {
    setState(() => _isLoading = true);
    try {
      await apiClient.put(
        '/cases/${widget.caseId}/status',
        data: {'new_status_id': newStatusId},
      );
      _fetchData();
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading && _caseData == null)
      return const Scaffold(body: Center(child: CircularProgressIndicator()));

    final currentStatus = _statuses.firstWhere(
      (s) => s['id'] == _caseData?['status_id'],
      orElse: () => {'name': 'Sin Estado'},
    );
    final availableTransitions = _transitions
        .where((t) => t['from_status_id'] == _caseData?['status_id'])
        .toList();

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: Text('Registro #${widget.caseId}'),
          actions: [
            if (!_isEditing)
              IconButton(
                icon: const Icon(Icons.edit),
                onPressed: () => setState(() => _isEditing = true),
              )
            else
              IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => setState(() => _isEditing = false),
              ),
          ],
          bottom: const TabBar(
            labelColor: Colors.blueAccent,
            indicatorColor: Colors.blueAccent,
            tabs: [
              Tab(icon: Icon(Icons.info_outline), text: 'Info'),
              Tab(icon: Icon(Icons.history), text: 'Historial'),
              Tab(icon: Icon(Icons.chat_bubble_outline), text: 'Chat'),
              Tab(icon: Icon(Icons.draw), text: 'Firmar'),
            ],
          ),
        ),
        body: Column(
          children: [
            // HEADER (ESTADO Y TRANSICIONES)
            if (!_isEditing)
              _buildStaticHeader(currentStatus, availableTransitions),

            Expanded(
              child: TabBarView(
                children: [
                  _buildDetailsTab(),
                  _buildHistoryTab(),
                  CaseCommentsWidget(
                    caseId: widget.caseId,
                    companyUsers:
                        _companyUsers, // Le pasamos los usuarios para el @
                  ), // 🔥 ¡CHAT CONECTADO!
                  _buildSignatureTab(),
                ],
              ),
            ),
          ],
        ),
        // BOTÓN FLOTANTE PARA GUARDAR (SOLO EN EDICIÓN)
        floatingActionButton: _isEditing
            ? FloatingActionButton.extended(
                onPressed: _isSaving ? null : _saveChanges,
                label: _isSaving
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Text("Guardar Cambios"),
                icon: const Icon(Icons.save),
                backgroundColor: Colors.green,
              )
            : null,
      ),
    );
  }

  Widget _buildStaticHeader(currentStatus, availableTransitions) {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Theme.of(context).cardColor,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Chip(
            label: Text(currentStatus['name'].toString().toUpperCase()),
            backgroundColor: Colors.amber.withOpacity(0.1),
            labelStyle: const TextStyle(
              color: Colors.amber,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (availableTransitions.isNotEmpty) ...[
            const SizedBox(height: 12),
            SizedBox(
              height: 38,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: availableTransitions.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final trans = availableTransitions[index];
                  return FilledButton(
                    onPressed: () => _changeStatus(trans['to_status_id']),
                    style: FilledButton.styleFrom(
                      backgroundColor: Colors.blueAccent.withOpacity(0.1),
                      foregroundColor: Colors.blueAccent,
                    ),
                    child: Text(trans['name']),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDetailsTab() {
    final activeSections = _sections.isEmpty
        ? [
            {'id': null, 'title': 'Información General'},
          ]
        : _sections;

    // 🔥 FIX 1 y 2: Filtrar por el Formulario del registro y Ordenarlos
    final currentFormId = _caseData?['form_id'];
    var formFields = _fields
        .where((f) => f['form_id'] == currentFormId)
        .toList();

    // Ordenamos por la propiedad 'order' (como en React)
    formFields.sort((a, b) => (a['order'] ?? 0).compareTo(b['order'] ?? 0));

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // SELECTOR DE ASIGNADO (MODO EDICIÓN)
        if (_isEditing)
          Padding(
            padding: const EdgeInsets.only(bottom: 16),
            child: DropdownButtonFormField<int>(
              value: _editAssignedTo,
              decoration: const InputDecoration(
                labelText: "Asignado a",
                border: OutlineInputBorder(),
              ),
              items: _companyUsers
                  .map(
                    (u) => DropdownMenuItem<int>(
                      value: u['id'],
                      child: Text(u['first_name'] ?? u['email']),
                    ),
                  )
                  .toList(),
              onChanged: (val) => setState(() => _editAssignedTo = val),
            ),
          ),

        ...activeSections.map((section) {
          // Extraemos solo los campos de esta sección
          final sectionFields = formFields
              .where(
                (f) =>
                    f['section_id'] == section['id'] ||
                    (f['section_id'] == null && section['id'] == null),
              )
              .toList();

          if (sectionFields.isEmpty) return const SizedBox.shrink();

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                section['title'] ?? '',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: Colors.blueAccent,
                ),
              ),
              const SizedBox(height: 12),
              ...sectionFields.map((field) => _buildFieldWidget(field)),
              const Divider(height: 32),
            ],
          );
        }),
      ],
    );
  }

  Widget _buildFieldWidget(Map<String, dynamic> field) {
    final key = field['api_name'] ?? field['label'];
    final value = _isEditing ? _editFormData[key] : _caseData?['data']?[key];

    // Ocultar campos según las UI Rules
    final uiRules = _caseData?['ui_rules']?[key] ?? {};
    if (uiRules['hidden'] == true) {
      return const SizedBox.shrink();
    }

    final isReadOnly = uiRules['readonly'] == true;
    final fieldType = field['field_type'] ?? 'text'; // Identificamos el tipo

    // ==========================================
    // 👁️ MODO LECTURA (Vista normal)
    // ==========================================
    if (!_isEditing) {
      String displayValue = '--';
      if (value != null && value.toString().trim() != '') {
        if (value is bool) {
          displayValue = value ? 'Sí' : 'No';
        } else if (value is List) {
          displayValue = '${value.length} elemento(s) vinculado(s)';
        } else {
          displayValue = value.toString();
        }
      }

      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              field['label'].toUpperCase(),
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.bold,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 2),
            Text(displayValue, style: const TextStyle(fontSize: 15)),
          ],
        ),
      );
    }

    // ==========================================
    // ✏️ MODO EDICIÓN DINÁMICO
    // ==========================================

    // 1. CAMPOS COMPLEJOS (Subformularios, Archivos, Imágenes, Relaciones)
    // Se bloquean en la app móvil con un aviso para editarlos en la Web.
    if ([
      'subform',
      'file',
      'image',
      'relation',
      'map',
      'formula',
    ].contains(fieldType)) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: TextFormField(
          initialValue: 'Edición disponible en versión web',
          readOnly: true,
          decoration: InputDecoration(
            labelText: field['label'],
            border: const OutlineInputBorder(),
            filled: true,
            fillColor: Colors.grey.withOpacity(0.1),
            suffixIcon: const Icon(Icons.computer, size: 16),
          ),
        ),
      );
    }

    // 2. CHECKBOX / BOOLEANOS
    if (fieldType == 'checkbox' || fieldType == 'boolean') {
      bool isChecked = value == true || value == 'true';
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.withOpacity(0.5)),
            borderRadius: BorderRadius.circular(4),
          ),
          child: SwitchListTile(
            title: Text(
              field['label'],
              style: const TextStyle(fontSize: 14, color: Colors.grey),
            ),
            value: isChecked,
            onChanged: isReadOnly
                ? null
                : (val) {
                    setState(() => _editFormData[key] = val);
                  },
          ),
        ),
      );
    }

    // 3. SELECTORES (Dropdowns)
    if (fieldType == 'select') {
      List<String> options = [];
      if (field['options'] is List) {
        options = (field['options'] as List).map((e) => e.toString()).toList();
      }

      String? currentValue = value?.toString();
      if (!options.contains(currentValue)) currentValue = null;

      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: DropdownButtonFormField<String>(
          value: currentValue,
          decoration: InputDecoration(
            labelText: field['label'],
            border: const OutlineInputBorder(),
            filled: isReadOnly,
            fillColor: isReadOnly ? Colors.grey.withOpacity(0.1) : null,
          ),
          items: options
              .map((o) => DropdownMenuItem(value: o, child: Text(o)))
              .toList(),
          onChanged: isReadOnly
              ? null
              : (val) {
                  setState(() => _editFormData[key] = val);
                },
        ),
      );
    }

    // 4. CAMPOS DE TEXTO Y NÚMEROS (text, textarea, number, email, date)
    int maxLines = fieldType == 'textarea' ? 3 : 1;
    TextInputType keyboard = TextInputType.text;
    if (fieldType == 'number') keyboard = TextInputType.number;
    if (fieldType == 'email') keyboard = TextInputType.emailAddress;
    if (fieldType == 'url') keyboard = TextInputType.url;
    if (fieldType == 'date') keyboard = TextInputType.datetime;

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        initialValue: value?.toString(),
        readOnly: isReadOnly,
        maxLines: maxLines,
        keyboardType: keyboard,
        decoration: InputDecoration(
          labelText: field['label'],
          border: const OutlineInputBorder(),
          filled: isReadOnly,
          fillColor: isReadOnly ? Colors.grey.withOpacity(0.1) : null,
          suffixIcon: isReadOnly
              ? const Icon(Icons.lock_outline, size: 16)
              : null,
        ),
        onChanged: (val) {
          if (fieldType == 'number') {
            // Guardamos como número si es posible
            _editFormData[key] = num.tryParse(val) ?? val;
          } else {
            _editFormData[key] = val;
          }
        },
      ),
    );
  }

  Widget _buildHistoryTab() {
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _history.length,
      separatorBuilder: (_, __) => const Divider(),
      itemBuilder: (context, index) {
        final log = _history[index];
        return ListTile(
          title: Text(log['action'] ?? 'Acción'),
          subtitle: Text(log['created_at'].toString().split('.')[0]),
          leading: const Icon(Icons.history),
        );
      },
    );
  }

  // ==========================================
  // 🔥 PESTAÑA DE FIRMA EMBEBIDA
  // ==========================================
  // ==========================================
  // 🔥 PESTAÑA DE FIRMA EMBEBIDA
  // ==========================================
  Widget _buildSignatureTab() {
    // Si ya generamos la URL y tenemos el controlador, mostramos el WebView incrustado
    if (_webViewController != null) {
      return Column(
        children: [
          Container(
            color: Colors.grey.shade900,
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => setState(
                    () => _webViewController = null,
                  ), // Cierra la vista
                  tooltip: 'Cancelar Firma',
                ),
                const Text(
                  "Firma de Documento Seguro",
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                const Icon(
                  Icons.lock,
                  size: 14,
                  color: Colors.teal,
                ), // 🔥 Cambiado de emerald a teal
                const SizedBox(width: 4),
                const Text(
                  "Conexión Segura",
                  style: TextStyle(color: Colors.teal, fontSize: 12),
                ), // 🔥 Cambiado de emerald a teal
              ],
            ),
          ),
          Expanded(child: WebViewWidget(controller: _webViewController!)),
        ],
      );
    }

    // Si no, mostramos el diseño original con el botón de "Generar"
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.teal.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.draw, size: 60, color: Colors.teal),
          ),
          const SizedBox(height: 24),
          const Text(
            "Firma Presencial",
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 12),
          const Text(
            "Genera la URL única para que el cliente firme este documento ahora mismo desde tu dispositivo.",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey, fontSize: 14),
          ),
          const SizedBox(height: 40),

          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.teal[600],
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              icon: _isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : const Icon(Icons.touch_app),
              label: Text(
                _isLoading
                    ? "Generando sala segura..."
                    : "Generar y Firmar Ahora",
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              onPressed: _isLoading ? null : _handleEmbeddedSignature,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _handleEmbeddedSignature() async {
    setState(() => _isLoading = true);
    try {
      // 1. BUSCAR UNA PLANTILLA (Requisito de FastAPI)
      // Buscamos la primera plantilla disponible para este módulo
      final moduleId = _caseData?['module_id'];
      final templatesRes = await apiClient.get(
        '/modules/$moduleId/integrations/signaturit/templates',
      );
      final templates = templatesRes.data as List;

      if (templates.isEmpty) {
        throw Exception(
          "No hay plantillas configuradas en Signaturit para este módulo.",
        );
      }

      final templateId = templates.first['id'];

      // 2. PREPARAR LOS DATOS COMO FORM-DATA (Igual que en React)
      // FastAPI espera que 'signers' sea un String en formato JSON
      final signersJson = jsonEncode([
        {'name': 'Cliente Presencial', 'email': 'cliente@grapp.com'},
      ]);

      final formData = FormData.fromMap({
        'delivery_type': 'url',
        'signature_type': 'advanced',
        'template_id': templateId,
        'signers': signersJson,
      });

      // 3. ENVIAR LA PETICIÓN
      final response = await apiClient.post(
        '/cases/${widget.caseId}/signaturit/send',
        data: formData,
      );

      final signatureUrl = response.data['signature_url'];

      // 4. ABRIR LA FIRMA SEGÚN LA PLATAFORMA
      if (signatureUrl != null) {
        if (kIsWeb) {
          // 💻 SI ESTAMOS EN LA WEB (Chrome, Safari, etc.)
          // Abrimos una pestaña nueva porque los WebViews nativos no funcionan aquí
          // y Signaturit bloquea los iframes por seguridad.
          final Uri url = Uri.parse(signatureUrl);
          await launchUrl(url, mode: LaunchMode.externalApplication);

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text(
                  'Abriendo sala de firmas en una nueva pestaña...',
                ),
                backgroundColor: Colors.teal,
              ),
            );
          }
        } else {
          // 📱 SI ESTAMOS EN EL CELULAR (iOS/Android)
          // Incrustamos el WebView maravillosamente en la pantalla
          final controller = WebViewController()
            ..setJavaScriptMode(JavaScriptMode.unrestricted)
            ..setBackgroundColor(const Color(0x00000000))
            ..loadRequest(Uri.parse(signatureUrl));

          setState(() {
            _webViewController = controller;
          });
        }
      }
      // 🔥 PARTE RESTAURADA: Manejo de errores y fin del loader
    } on DioException catch (e) {
      if (mounted) {
        final errorMessage = e.response?.data['detail'] ?? e.message;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error del Servidor: $errorMessage'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: ${e.toString()}'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }
} // 🔥 Llave final que cierra la clase _CaseDetailScreenState
