import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'chat_screen.dart';
import 'market_service.dart';

class ActivityDetailScreen extends StatefulWidget {
  final Map<String, dynamic> activity;
  final String tagText;

  const ActivityDetailScreen({
    super.key,
    required this.activity,
    required this.tagText,
  });

  @override
  State<ActivityDetailScreen> createState() => _ActivityDetailScreenState();
}

class _ActivityDetailScreenState extends State<ActivityDetailScreen> {
  final MarketService _marketService = MarketService();

  bool _isLoading = true;
  List<dynamic> _timeline = [];
  Color _themeColor = Colors.black; // Color por defecto

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    final caseId = widget.activity['id'];
    try {
      // Traemos el color y la línea de tiempo al mismo tiempo
      final results = await Future.wait([
        _marketService.getMobileSettings(),
        _marketService.getTimeline(caseId),
      ]);

      final settings = results[0] as Map<String, dynamic>;
      final hexColor = settings['theme_color']?.toString() ?? '#000000';

      setState(() {
        _themeColor = _parseHexColor(hexColor);
        _timeline = results[1] as List<dynamic>;
      });
    } catch (e) {
      debugPrint("Error loading details: $e");
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // 🔥 MAGIA: Convierte el #FF00FF del backend en un Color de Flutter 🔥
  Color _parseHexColor(String hexString) {
    hexString = hexString.toUpperCase().replaceAll('#', '');
    if (hexString.length == 6) {
      hexString = 'FF$hexString'; // Le agregamos opacidad 100%
    }
    return Color(int.tryParse(hexString, radix: 16) ?? 0xFF000000);
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    final data = widget.activity['data'] as Map<String, dynamic>;
    final caseId = widget.activity['id'];

    String title = data['producto_origen']?.toString() ?? '';
    if (title.isEmpty || title.toLowerCase() == 'no especificado')
      title = data['nombre_del_producto']?.toString() ?? '';
    if (title.isEmpty) title = data['producto']?.toString() ?? '';
    if (title.isEmpty) title = data['nombre']?.toString() ?? '';
    if (title.isEmpty) {
      bool isContract = widget.tagText == 'COMPRA' || widget.tagText == 'VENTA';
      title = isContract ? 'CONTRATO #$caseId' : 'OFERTA #$caseId';
    }

    final price = data['precio_acordado'] ?? data['precio'] ?? '--';
    final volume = data['volumen_acordado'] ?? data['volumen'] ?? '--';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F7),
      appBar: AppBar(
        title: Text(
          '${widget.tagText} #$caseId',
          style: const TextStyle(
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
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: _themeColor))
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // 🔥 RESUMEN DE LA OPERACIÓN 🔥
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title.toUpperCase(),
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildInfoColumn('Valor Total', '\$$price'),
                            _buildInfoColumn('Volumen', '$volume'),
                            _buildInfoColumn(
                              'Fecha',
                              widget.activity['created_at'].toString().split(
                                'T',
                              )[0],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 🔥 LÍNEA DE TIEMPO DINÁMICA 🔥
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 32,
                    ),
                    width: double.infinity,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'ESTADO DE LA OPERACIÓN',
                          style: TextStyle(
                            color: Colors.black38,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 2.0,
                          ),
                        ),
                        const SizedBox(height: 32),

                        if (_timeline.isEmpty)
                          const Text(
                            "No hay un flujo configurado para esta operación.",
                            style: TextStyle(
                              color: Colors.black54,
                              fontStyle: FontStyle.italic,
                            ),
                          )
                        else
                          ..._timeline.asMap().entries.map((entry) {
                            int idx = entry.key;
                            var step = entry.value;
                            return _buildTimelineStep(
                              title: step['name'],
                              description: step['description'] ?? '',
                              isCompleted: step['is_completed'],
                              isCurrent: step['is_current'],
                              isLast: idx == _timeline.length - 1,
                            );
                          }).toList(),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // 🔥 BOTÓN DE CONTACTO A SOPORTE 🔥
                  Container(
                    color: Colors.white,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '¿NECESITAS AYUDA?',
                          style: TextStyle(
                            color: Colors.black38,
                            fontWeight: FontWeight.w900,
                            fontSize: 12,
                            letterSpacing: 2.0,
                          ),
                        ),
                        const SizedBox(height: 16),
                        const Text(
                          'Ponte en contacto con nuestro equipo para resolver dudas sobre esta operación.',
                          style: TextStyle(fontSize: 14, color: Colors.black54),
                        ),
                        const SizedBox(height: 24),
                        SizedBox(
                          width: double.infinity,
                          height: 54,
                          child: ElevatedButton.icon(
                            icon: const Icon(Icons.support_agent, size: 20),
                            label: const Text(
                              'CONTACTAR A GRAPP',
                              style: TextStyle(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                                letterSpacing: 1.0,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor:
                                  _themeColor, // 🔥 COLOR DINÁMICO AQUÍ 🔥
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) =>
                                      ChatScreen(caseId: caseId, title: title),
                                ),
                              );
                            },
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

  Widget _buildInfoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: const TextStyle(
            fontSize: 10,
            color: Colors.black38,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.0,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: Colors.black,
          ),
        ),
      ],
    );
  }

  // WIDGET: Pasos de la Línea de Tiempo
  Widget _buildTimelineStep({
    required String title,
    required String description,
    required bool isCompleted,
    required bool isCurrent,
    required bool isLast,
  }) {
    // Si ya pasó o es el actual, usamos el color principal. Si es futuro, gris.
    final isActive = isCompleted || isCurrent;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Columna de Ícono y Línea
          Column(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: isCompleted
                      ? _themeColor
                      : (isCurrent ? Colors.white : Colors.white),
                  border: Border.all(
                    color: isActive ? _themeColor : Colors.grey.shade300,
                    width: isCurrent ? 3 : 2, // Más grueso si es el actual
                  ),
                  shape: BoxShape.circle,
                ),
                child: isCompleted
                    ? const Icon(Icons.check, size: 14, color: Colors.white)
                    : (isCurrent
                          ? Center(
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: _themeColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                            )
                          : null),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    color: isCompleted
                        ? _themeColor.withOpacity(0.5)
                        : Colors.grey.shade200,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          // Columna de Textos
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 32.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                      color: isCurrent
                          ? _themeColor
                          : (isCompleted ? Colors.black : Colors.black38),
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (description.isNotEmpty)
                    Text(
                      description,
                      style: TextStyle(
                        fontSize: 13,
                        color: isActive ? Colors.black54 : Colors.black26,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
