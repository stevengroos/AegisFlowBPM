import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import '../core/api_client.dart';
import 'case_comments_widget.dart'; // 🔥 Importamos el chat

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
      length: 3,
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
          final sectionFields = _fields
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

    if (!_isEditing) {
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
            Text(
              value?.toString() ?? '--',
              style: const TextStyle(fontSize: 15),
            ),
          ],
        ),
      );
    }

    // MODO EDICIÓN: Renderizamos inputs
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        initialValue: value?.toString(),
        decoration: InputDecoration(
          labelText: field['label'],
          border: const OutlineInputBorder(),
        ),
        onChanged: (val) => _editFormData[key] = val,
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
}
