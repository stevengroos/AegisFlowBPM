import 'dart:async';
import 'package:flutter/material.dart';
import '../core/api_client.dart';
import 'case_create_screen.dart';
import 'case_detail_screen.dart';

class CasesScreen extends StatefulWidget {
  final int moduleId;
  final String moduleName;

  const CasesScreen({
    super.key,
    required this.moduleId,
    required this.moduleName,
  });

  @override
  State<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends State<CasesScreen> {
  final ScrollController _scrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  Timer? _debounce;

  // Estados de Datos
  List<dynamic> _cases = [];
  bool _isLoading = false;
  bool _hasMore = true;
  int _skip = 0;
  final int _limit = 15;

  // 🔥 NUEVO: Estados para Filtros Dinámicos
  List<dynamic> _fields = [];
  String _searchTerm = "";
  DateTime? _startDate;
  DateTime? _endDate;
  final Map<String, String> _activeFieldFilters =
      {}; // Guarda { "api_name": "valor a buscar" }

  @override
  void initState() {
    super.initState();
    _fetchFieldsAndCases(); // Traemos campos y casos al mismo tiempo
    _scrollController.addListener(() {
      if (_scrollController.position.pixels >=
          _scrollController.position.maxScrollExtent - 200) {
        _fetchCases();
      }
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  // 🔥 1. Traer los campos del formulario para armar el menú de filtros 🔥
  Future<void> _fetchFieldsAndCases() async {
    _fetchCases(); // Empezamos a cargar los casos de inmediato para que el usuario no espere

    try {
      // Buscamos el formulario del módulo
      final formsRes = await apiClient.get(
        '/forms/',
        queryParameters: {'module_id': widget.moduleId},
      );
      final List forms = formsRes.data ?? [];

      if (forms.isNotEmpty) {
        final formId = forms.first['id'];
        // Buscamos los campos de ese formulario
        final fieldsRes = await apiClient.get(
          '/fields/',
          queryParameters: {'form_id': formId},
        );
        if (mounted) {
          setState(() {
            _fields = fieldsRes.data ?? [];
          });
        }
      }
    } catch (e) {
      debugPrint("Error cargando campos para los filtros: $e");
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () {
      setState(() => _searchTerm = query);
      _fetchCases(isRefresh: true);
    });
  }

  Future<void> _fetchCases({bool isRefresh = false}) async {
    if (_isLoading || (!_hasMore && !isRefresh)) return;

    if (isRefresh) {
      setState(() {
        _skip = 0;
        _hasMore = true;
        _cases = [];
      });
    }

    setState(() => _isLoading = true);

    try {
      final Map<String, dynamic> queryParams = {
        'module_id': widget.moduleId,
        'skip': _skip,
        'limit': _limit,
      };

      if (_searchTerm.trim() != "") queryParams['search'] = _searchTerm;
      if (_startDate != null)
        queryParams['start_date'] = _startDate!.toIso8601String().split('T')[0];
      if (_endDate != null)
        queryParams['end_date'] = _endDate!.toIso8601String().split('T')[0];

      // 🔥 Inyectamos los filtros dinámicos en la petición al backend 🔥
      _activeFieldFilters.forEach((key, value) {
        if (value.trim().isNotEmpty) {
          queryParams[key] = value;
        }
      });

      final response = await apiClient.get(
        '/cases/',
        queryParameters: queryParams,
      );
      final List newCases = response.data ?? [];

      setState(() {
        _skip += newCases.length;
        _cases.addAll(newCases);
        if (newCases.length < _limit) _hasMore = false;
      });
    } catch (e) {
      debugPrint("Error cargando casos: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  String _getSafeTitle(dynamic c) {
    String fallbackTitle = "Registro #${c['id'] ?? 'Desconocido'}";
    try {
      if (c['data'] != null &&
          c['data'] is Map &&
          (c['data'] as Map).keys.isNotEmpty) {
        final firstValue = (c['data'] as Map).values.first;
        if (firstValue != null && firstValue.toString().trim() != "")
          return firstValue.toString();
      }
    } catch (e) {
      debugPrint("Error parseando título: $e");
    }
    return fallbackTitle;
  }

  String _getTimeAgo(String? dateString) {
    if (dateString == null) return "Desconocida";
    try {
      final date = DateTime.parse(dateString);
      final diff = DateTime.now().difference(date);
      if (diff.inHours == 0) return "Hace < 1 h";
      if (diff.inHours < 24) return "Hace ${diff.inHours} h";
      if (diff.inDays == 1) return "Hace 1 día";
      return "Hace ${diff.inDays} días";
    } catch (e) {
      return "Fecha inválida";
    }
  }

  @override
  Widget build(BuildContext context) {
    // Calculamos si hay filtros activos para pintar el ícono de azul
    final hasActiveFilters =
        _startDate != null ||
        _endDate != null ||
        _activeFieldFilters.values.any((v) => v.isNotEmpty);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.moduleName,
          style: const TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          Builder(
            builder: (context) {
              return IconButton(
                icon: Icon(
                  Icons.filter_list,
                  color: hasActiveFilters ? Colors.blueAccent : null,
                ),
                onPressed: () => Scaffold.of(context).openEndDrawer(),
              );
            },
          ),
        ],
      ),
      endDrawer: Drawer(
        child:
            _buildFilterDrawer(), // 🔥 Llamamos a nuestro panel de filtros vitaminado
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: "Buscar por ID o datos...",
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.trim() != ""
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          _onSearchChanged("");
                        },
                      )
                    : null,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _fetchCases(isRefresh: true),
              child: _cases.isEmpty && !_isLoading
                  ? _buildEmptyState()
                  : ListView.builder(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: _cases.length + (_hasMore ? 1 : 0),
                      itemBuilder: (context, index) {
                        if (index == _cases.length) {
                          return const Padding(
                            padding: EdgeInsets.all(32),
                            child: Center(child: CircularProgressIndicator()),
                          );
                        }
                        return _buildCaseCard(_cases[index]);
                      },
                    ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          // Navegamos a la pantalla de creación y esperamos a ver si devuelve 'true'
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CaseCreateScreen(
                moduleId: widget.moduleId,
                moduleName: widget.moduleName,
              ),
            ),
          );

          // Si el modal devolvió true, significa que se creó un registro. Recargamos la lista.
          if (result == true) {
            _fetchCases(isRefresh: true);
          }
        },
        backgroundColor: Colors.blueAccent,
        child: const Icon(Icons.add, color: Colors.white),
      ),
    );
  }

  // =======================================================
  // 🔥 EL NUEVO CAJÓN DE FILTROS AVANZADOS (DRAWER) 🔥
  // =======================================================
  Widget _buildFilterDrawer() {
    // Filtramos los campos que AÚN NO han sido agregados a los filtros activos
    final availableFields = _fields
        .where(
          (f) => !_activeFieldFilters.containsKey(f['api_name'] ?? f['label']),
        )
        .toList();

    return SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  "Filtros Activos",
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                if (_startDate != null ||
                    _endDate != null ||
                    _activeFieldFilters.isNotEmpty)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _startDate = null;
                        _endDate = null;
                        _activeFieldFilters.clear();
                      });
                      _fetchCases(isRefresh: true);
                    },
                    child: const Text("Limpiar todo"),
                  ),
              ],
            ),
          ),

          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                const Text(
                  "Rango de Fechas",
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    _startDate == null
                        ? "Desde"
                        : _startDate!.toLocal().toString().split(' ')[0],
                    style: const TextStyle(fontSize: 14),
                  ),
                  leading: const Icon(Icons.calendar_today, size: 20),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _startDate = date);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    _endDate == null
                        ? "Hasta"
                        : _endDate!.toLocal().toString().split(' ')[0],
                    style: const TextStyle(fontSize: 14),
                  ),
                  leading: const Icon(Icons.calendar_month, size: 20),
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _endDate = date);
                  },
                ),

                if (_activeFieldFilters.isNotEmpty) ...[
                  const Divider(height: 32),
                  const Text(
                    "Campos del Formulario",
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.grey,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Pintamos los filtros activos dinámicos
                  ..._activeFieldFilters.entries.map((entry) {
                    final fieldDef = _fields.firstWhere(
                      (f) => (f['api_name'] ?? f['label']) == entry.key,
                      orElse: () => {'label': entry.key},
                    );

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              initialValue: entry.value,
                              onChanged: (val) {
                                _activeFieldFilters[entry.key] =
                                    val; // Actualiza el filtro
                              },
                              decoration: InputDecoration(
                                labelText: fieldDef['label'],
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                contentPadding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 0,
                                ),
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.delete_outline,
                              color: Colors.redAccent,
                            ),
                            onPressed: () {
                              setState(() {
                                _activeFieldFilters.remove(entry.key);
                              });
                            },
                          ),
                        ],
                      ),
                    );
                  }),
                ],

                const SizedBox(height: 16),

                // 🔥 EQUIVALENTE A REACT-SELECT 🔥
                if (availableFields.isNotEmpty)
                  PopupMenuButton<String>(
                    tooltip: "Añadir campo",
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        vertical: 12,
                        horizontal: 16,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.blue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.blue.withOpacity(0.3)),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.add, color: Colors.blueAccent, size: 18),
                          SizedBox(width: 8),
                          Text(
                            "Añadir regla de filtro",
                            style: TextStyle(
                              color: Colors.blueAccent,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    onSelected: (key) {
                      setState(() {
                        _activeFieldFilters[key] =
                            ""; // Añade el campo en blanco
                      });
                    },
                    itemBuilder: (context) {
                      return availableFields.map((f) {
                        return PopupMenuItem<String>(
                          value: f['api_name'] ?? f['label'],
                          child: Text(f['label'] ?? 'Sin nombre'),
                        );
                      }).toList();
                    },
                  ),
              ],
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(20.0),
            child: SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  _fetchCases(isRefresh: true);
                  Navigator.pop(context); // Cierra el Drawer y busca
                },
                style: FilledButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                child: const Text(
                  "Aplicar Filtros",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return ListView(
      children: [
        const SizedBox(height: 100),
        const Icon(Icons.search_off, size: 64, color: Colors.grey),
        const SizedBox(height: 16),
        Center(
          child: Text(
            _searchController.text.trim() == ""
                ? 'Aún no hay registros.'
                : 'No se encontraron coincidencias.',
            style: const TextStyle(color: Colors.grey),
          ),
        ),
      ],
    );
  }

  Widget _buildCaseCard(dynamic c) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        side: BorderSide(color: Colors.grey.withOpacity(0.2)),
        borderRadius: BorderRadius.circular(16),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16),
        leading: CircleAvatar(
          backgroundColor: Colors.blue.withOpacity(0.1),
          child: Text(
            '#${c['id'] ?? '0'}',
            style: const TextStyle(
              color: Colors.blue,
              fontWeight: FontWeight.bold,
              fontSize: 12,
            ),
          ),
        ),
        title: Text(
          _getSafeTitle(c),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Row(
            children: [
              const Icon(Icons.access_time, size: 14, color: Colors.grey),
              const SizedBox(width: 4),
              Text(
                _getTimeAgo(c['created_at']),
                style: const TextStyle(fontSize: 12, color: Colors.grey),
              ),
            ],
          ),
        ),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.amber.withOpacity(0.1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            c['status']?['name'] ?? 'Activo',
            style: const TextStyle(
              color: Colors.amber,
              fontSize: 12,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        onTap: () async {
          // Vamos al detalle. Usamos 'await' por si el usuario cambia el estado allá y necesitamos recargar.
          await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => CaseDetailScreen(
                caseId: c['id'],
                moduleName: widget.moduleName,
              ),
            ),
          );
          // Al volver de la pantalla de detalle, recargamos la lista por si el estado o los datos cambiaron
          _fetchCases(isRefresh: true);
        },
      ),
    );
  }
}
