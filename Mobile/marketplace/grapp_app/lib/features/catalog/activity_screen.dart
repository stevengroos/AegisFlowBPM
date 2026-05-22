import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'market_service.dart';
import '../auth/auth_service.dart';
import 'activity_detail_screen.dart';

class ActivityScreen extends StatefulWidget {
  const ActivityScreen({super.key});

  @override
  State<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends State<ActivityScreen> {
  final MarketService _marketService = MarketService();
  final AuthService _authService = AuthService();

  List<dynamic> _activities = [];
  List<dynamic> _filteredActivities = []; // 🔥 Lista para el buscador
  Map<String, dynamic>? _userData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadActivity();
  }

  Future<void> _loadActivity() async {
    try {
      final results = await Future.wait([
        _marketService.getMyActivity(),
        _authService.getUserProfile(),
      ]);

      setState(() {
        _activities = results[0] as List<dynamic>;
        _filteredActivities = _activities; // 🔥 Llenamos el buscador al inicio
        _userData = results[1] as Map<String, dynamic>;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // 🔥 MAGIA: Función para buscar y filtrar en tiempo real 🔥
  void _filterActivities(String query) {
    if (query.isEmpty) {
      setState(() => _filteredActivities = _activities);
      return;
    }

    final lowerQuery = query.toLowerCase();
    setState(() {
      _filteredActivities = _activities.where((act) {
        final data = act['data'] as Map<String, dynamic>;

        // Extraemos el nombre con la misma lógica que usamos para dibujarlo
        String title = data['producto_origen']?.toString() ?? '';
        if (title.isEmpty || title.toLowerCase() == 'no especificado') {
          title = data['nombre_del_producto']?.toString() ?? '';
        }
        if (title.isEmpty) title = data['producto']?.toString() ?? '';
        if (title.isEmpty) title = data['nombre']?.toString() ?? '';

        final idStr = act['id'].toString();

        // Filtramos si el texto buscado coincide con el NOMBRE o con el ID
        return title.toLowerCase().contains(lowerQuery) ||
            idStr.contains(lowerQuery);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);
    final String myUserId = _userData?['id']?.toString() ?? '';

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text(
          'MIS OPERACIONES',
          style: TextStyle(
            color: Colors.black,
            fontWeight: FontWeight.w900,
            fontSize: 16,
            letterSpacing: 1.0,
          ),
        ),
        backgroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        foregroundColor: Colors.black,
      ),
      body: Column(
        children: [
          // 💎 BUSCADOR MINIMALISTA 💎
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: const BoxDecoration(
              border: Border(
                bottom: BorderSide(color: Color(0xFFEEEEEE), width: 1),
              ),
            ),
            child: Container(
              height: 48,
              decoration: BoxDecoration(
                color: const Color(0xFFF7F7F7),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                children: [
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16),
                    child: Icon(Icons.search, color: Colors.black, size: 24),
                  ),
                  Expanded(
                    child: TextField(
                      onChanged: _filterActivities, // Conectado al filtro
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        hintText: 'Buscar por nombre o #ID...',
                        hintStyle: TextStyle(
                          color: Colors.grey.shade500,
                          fontSize: 16,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 💎 LISTA DE OPERACIONES 💎
          Expanded(
            child: _isLoading
                ? const Center(
                    child: CircularProgressIndicator(color: Colors.black),
                  )
                : _filteredActivities.isEmpty
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: const [
                        Icon(Icons.search_off, color: Colors.black12, size: 80),
                        SizedBox(height: 16),
                        Text(
                          'NO SE ENCONTRARON RESULTADOS',
                          style: TextStyle(
                            color: Colors.black38,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
                          ),
                        ),
                      ],
                    ),
                  )
                : RefreshIndicator(
                    onRefresh: _loadActivity,
                    color: Colors.white,
                    backgroundColor: Colors.black,
                    child: ListView.separated(
                      padding: const EdgeInsets.only(
                        left: 16,
                        right: 16,
                        top: 16,
                        bottom: 40,
                      ),
                      itemCount: _filteredActivities
                          .length, // 🔥 Usamos la lista filtrada
                      separatorBuilder: (context, index) =>
                          const Divider(color: Color(0xFFEEEEEE), height: 32),
                      itemBuilder: (context, index) {
                        final act =
                            _filteredActivities[index]; // 🔥 Leemos de la filtrada
                        final data = act['data'] as Map<String, dynamic>;

                        // 🔥 BUSCADOR INTELIGENTE DE NOMBRES 🔥
                        String title =
                            data['producto_origen']?.toString() ?? '';

                        if (title.isEmpty ||
                            title.toLowerCase() == 'no especificado') {
                          title = data['nombre_del_producto']?.toString() ?? '';
                        }
                        if (title.isEmpty)
                          title = data['producto']?.toString() ?? '';
                        if (title.isEmpty)
                          title = data['nombre']?.toString() ?? '';

                        final String compradorId =
                            data['comprador_id']?.toString() ?? '';
                        final String vendedorId =
                            data['vendedor_id']?.toString() ?? '';
                        final String creatorId =
                            act['created_by']?.toString() ?? '';

                        final bool isContract =
                            compradorId.isNotEmpty ||
                            vendedorId.isNotEmpty ||
                            data.containsKey('precio_acordado') ||
                            data.containsKey('producto_origen');

                        // Si definitivamente no hay nombre, mostramos algo elegante
                        if (title.isEmpty) {
                          title = isContract
                              ? 'CONTRATO #${act['id']}'
                              : 'OFERTA #${act['id']}';
                        }

                        final price =
                            data['precio_acordado'] ?? data['precio'] ?? '--';

                        // 🔥 LÓGICA DE ETIQUETAS B2B 🔥
                        String tagText = 'PUBLICACIÓN';
                        Color tagBg = const Color(0xFFEEEEEE);
                        Color tagTextCol = Colors.black;
                        IconData icon = Icons.storefront;

                        if (isContract) {
                          if (compradorId == myUserId ||
                              creatorId == myUserId) {
                            tagText = 'COMPRA';
                            tagBg = Colors.black;
                            tagTextCol = Colors.white;
                            icon = Icons.shopping_bag_outlined;
                          } else {
                            tagText = 'VENTA';
                            tagBg = Colors.green.shade700;
                            tagTextCol = Colors.white;
                            icon = Icons.monetization_on_outlined;
                          }
                        }

                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF5F5F7),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Icon(icon, color: Colors.black54),
                          ),
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  title.toString().toUpperCase(),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w900,
                                    fontSize: 14,
                                    letterSpacing: 0.5,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: tagBg,
                                  borderRadius: BorderRadius.circular(2),
                                ),
                                child: Text(
                                  tagText,
                                  style: TextStyle(
                                    color: tagTextCol,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 1.0,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 6.0),
                            child: Text(
                              'Valor: \$$price',
                              style: const TextStyle(
                                fontSize: 13,
                                color: Colors.black54,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          trailing: const Icon(
                            Icons.arrow_forward_ios,
                            size: 14,
                            color: Colors.black,
                          ),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => ActivityDetailScreen(
                                  activity: act,
                                  tagText: tagText,
                                ),
                              ),
                            ).then((_) => _loadActivity());
                          },
                        );
                      },
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
