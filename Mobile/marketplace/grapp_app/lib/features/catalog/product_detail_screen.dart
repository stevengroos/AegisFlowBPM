import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme_provider.dart';
import 'market_service.dart';
import 'chat_screen.dart';
import 'dart:convert' as dart_convert;

class ProductDetailScreen extends StatefulWidget {
  final Map<String, dynamic> offer;
  final String titulo;
  final dynamic precio;
  final String imageUrl;
  final bool isDemandMode; // 🔥 NUEVO: Recibe el modo
  final double? currentStock; // 🔥 NUEVO: Recibe el stock actual
  final double? initialStock;

  const ProductDetailScreen({
    super.key,
    required this.offer,
    required this.titulo,
    required this.precio,
    required this.imageUrl,
    this.isDemandMode = false,
    this.currentStock,
    this.initialStock, // 🔥 NUEVO
  });

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  final MarketService _marketService = MarketService();
  bool _isProcessing = false;
  bool _isFavorite = false;

  Map<String, dynamic>? _checkoutFormConfig;
  Map<String, dynamic> _checkoutData = {};

  @override
  void initState() {
    super.initState();
    _checkFavoriteStatus();
  }

  Future<void> _checkFavoriteStatus() async {
    try {
      final favs = await _marketService.getFavorites();
      setState(
        () => _isFavorite = favs.any((f) => f['id'] == widget.offer['id']),
      );
    } catch (e) {
      // Ignorar error silente
    }
  }

  void _toggleFavorite() async {
    setState(() => _isFavorite = !_isFavorite);
    try {
      await _marketService.toggleFavorite(widget.offer['id']);
    } catch (e) {
      setState(() => _isFavorite = !_isFavorite);
    }
  }

  // ==========================================
  // 🔥 LÓGICA INTELIGENTE DE BOTÓN (COMPRAR O CUBRIR) 🔥
  // ==========================================
  Future<void> _startActionProcess() async {
    setState(() => _isProcessing = true);

    try {
      final settings = await _marketService.getMobileSettings();

      // Si estamos en Modo Demanda, usamos la config de Fulfillment
      final targetModuleId = widget.isDemandMode
          ? settings['fulfillment_module_id']
          : settings['purchases_module_id'];
      final targetFormId = widget.isDemandMode
          ? settings['fulfillment_form_id']
          : settings['purchases_form_id'];

      if (targetModuleId == null) {
        throw Exception(
          widget.isDemandMode
              ? "El módulo de coberturas no está configurado."
              : "El módulo de compras no está configurado.",
        );
      }

      if (targetFormId != null) {
        _checkoutFormConfig = await _marketService.getCheckoutFormConfig(
          targetFormId,
        );
      } else {
        _checkoutFormConfig = null;
      }

      if (!mounted) return;
      setState(() => _isProcessing = false);

      _showActionBottomSheet(context, targetModuleId, targetFormId ?? 0);
    } catch (e) {
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    String finalImageUrl = widget.imageUrl;
    if (finalImageUrl.isNotEmpty &&
        !finalImageUrl.startsWith('http') &&
        !finalImageUrl.startsWith('data:image')) {
      finalImageUrl = 'http://127.0.0.1:8000$finalImageUrl';
    }
    final Map<String, dynamic> data = widget.offer['data'] ?? {};
    final actionColor = widget.isDemandMode
        ? const Color(0xFF4F46E5)
        : Colors.black;

    return Scaffold(
      backgroundColor: Colors.white,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: Colors.white,
            foregroundColor: Colors.black,
            expandedHeight: 450,
            pinned: true,
            elevation: 0,
            leading: Container(
              margin: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.black, width: 2),
              ),
              child: IconButton(
                icon: const Icon(
                  Icons.arrow_back_ios,
                  color: Colors.black,
                  size: 18,
                ),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            actions: [
              Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border.all(color: Colors.black, width: 2),
                ),
                child: IconButton(
                  icon: Icon(
                    _isFavorite ? Icons.favorite : Icons.favorite_border,
                    color: _isFavorite ? Colors.redAccent : Colors.black,
                    size: 20,
                  ),
                  onPressed: _toggleFavorite,
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: finalImageUrl.isNotEmpty
                  ? (finalImageUrl.startsWith('data:image')
                        ? Image.memory(
                            dart_convert.base64Decode(
                              finalImageUrl.split(',').last,
                            ),
                            fit: BoxFit.cover,
                            errorBuilder: (c, e, s) =>
                                Container(color: const Color(0xFFF4F4F4)),
                          )
                        : Image.network(
                            finalImageUrl,
                            fit: BoxFit.cover,
                            errorBuilder: (c, e, s) =>
                                Container(color: const Color(0xFFF4F4F4)),
                          ))
                  : Container(
                      color: const Color(0xFFF4F4F4),
                      child: const Icon(
                        Icons.image_not_supported_outlined,
                        color: Colors.black12,
                        size: 60,
                      ),
                    ),
            ),
          ),

          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.titulo.toUpperCase(),
                    style: const TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -1.0,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 8),

                  // 🔥 INDICADOR DE STOCK CON BARRA FOMO 🔥
                  if (widget.currentStock != null) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          widget.isDemandMode
                              ? "VOLUMEN BUSCADO"
                              : "STOCK DISPONIBLE",
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: Colors.black45,
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          "${widget.currentStock} Unidades",
                          style: TextStyle(
                            color: widget.currentStock! < 50
                                ? Colors.redAccent
                                : actionColor,
                            fontWeight: FontWeight.w900,
                            fontSize: 18,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        // 🔥 FÓRMULA MATEMÁTICA 100% REAL 🔥
                        value:
                            (widget.initialStock != null &&
                                widget.initialStock! > 0)
                            ? (widget.currentStock! / widget.initialStock!)
                            : 1.0,
                        backgroundColor: Colors.grey.shade200,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          widget.currentStock! < 50
                              ? Colors.redAccent
                              : actionColor,
                        ),
                        minHeight: 8,
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  Text(
                    '\Gs ${widget.precio}',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w500,
                      color: Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 32),
                  const Divider(color: Color(0xFFEEEEEE), thickness: 1),
                  const SizedBox(height: 24),

                  const Text(
                    'ESPECIFICACIONES',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w900,
                      color: Colors.black45,
                      letterSpacing: 2.0,
                    ),
                  ),
                  const SizedBox(height: 16),

                  ...data.entries.map((entry) {
                    final String key = entry.key;
                    final dynamic value = entry.value;

                    if (key.contains('imagen') ||
                        key.contains('logo') ||
                        value == null ||
                        value.toString().isEmpty)
                      return const SizedBox.shrink();

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 16.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            key.replaceAll('_', ' ').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.black54,
                              letterSpacing: 1.0,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            value.toString(),
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w500,
                              color: Colors.black87,
                            ),
                          ),
                        ],
                      ),
                    );
                  }),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),

      bottomSheet: Container(
        color: Colors.white,
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          bottom: MediaQuery.of(context).padding.bottom + 16,
          top: 16,
        ),
        child: Row(
          children: [
            Container(
              height: 60,
              width: 60,
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border.all(color: Colors.black, width: 2),
              ),
              child: IconButton(
                icon: const Icon(
                  Icons.chat_bubble_outline,
                  color: Colors.black,
                ),
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => ChatScreen(
                      caseId: widget.offer['id'],
                      title: widget.titulo,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: SizedBox(
                height: 60,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: actionColor,
                    foregroundColor: Colors.white,
                    shape: const RoundedRectangleBorder(
                      borderRadius: BorderRadius.zero,
                    ),
                    elevation: 0,
                  ),
                  onPressed: _isProcessing ? null : _startActionProcess,
                  child: _isProcessing
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          widget.isDemandMode
                              ? 'CUBRIR DEMANDA'
                              : 'AÑADIR A LA BOLSA',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.5,
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

  void _showActionBottomSheet(
    BuildContext context,
    int targetModuleId,
    int targetFormId,
  ) {
    final TextEditingController volumeController = TextEditingController();
    bool isConfirming = false;
    final actionColor = widget.isDemandMode
        ? const Color(0xFF4F46E5)
        : Colors.black;

    final wizardSteps = _checkoutFormConfig?['wizard'] as List<dynamic>? ?? [];
    final fields = wizardSteps.isNotEmpty
        ? (wizardSteps[0]['fields'] as List<dynamic>? ?? [])
        : [];
    _checkoutData = {};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 32,
                left: 32,
                right: 32,
                top: 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 40),
                  Text(
                    widget.titulo.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -0.5,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Precio Base: \Gs ${widget.precio} / Unidad',
                    style: const TextStyle(
                      color: Colors.black54,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 48),

                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      widget.isDemandMode
                          ? 'VOLUMEN A CUBRIR'
                          : 'VOLUMEN REQUERIDO',
                      style: const TextStyle(
                        color: Colors.black45,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2.0,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: volumeController,
                    keyboardType: TextInputType.number,
                    enabled: !isConfirming,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: Colors.black,
                      fontSize: 48,
                      fontWeight: FontWeight.w900,
                      letterSpacing: -2.0,
                    ),
                    cursorColor: Colors.black,
                    onChanged: (val) {
                      // 🔥 PROTECCIÓN: NO PUEDE PASAR DEL STOCK MÁXIMO 🔥
                      if (widget.currentStock != null && val.isNotEmpty) {
                        final inputVol = double.tryParse(val);
                        if (inputVol != null &&
                            inputVol > widget.currentStock!) {
                          volumeController.text = widget.currentStock
                              .toString();
                          volumeController
                              .selection = TextSelection.fromPosition(
                            TextPosition(offset: volumeController.text.length),
                          );
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                "No puedes exceder el máximo de ${widget.currentStock} Unidades.",
                              ),
                              backgroundColor: Colors.redAccent,
                              duration: const Duration(seconds: 1),
                            ),
                          );
                        }
                      }
                    },
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: Colors.transparent,
                      hintText: '0',
                      hintStyle: TextStyle(color: Colors.grey.shade300),
                      suffixText: 'Unidades',
                      suffixStyle: const TextStyle(
                        color: Colors.black54,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                      enabledBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(
                          color: Color(0xFFEEEEEE),
                          width: 2,
                        ),
                      ),
                      focusedBorder: const UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.black, width: 3),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),

                  ...fields.map((f) {
                    final String apiName = f['api_name'];
                    final String label =
                        f['label'] + (f['required'] ? ' *' : '');
                    final String type = f['type'];

                    InputDecoration decor = InputDecoration(
                      labelText: label.toUpperCase(),
                      labelStyle: const TextStyle(
                        color: Colors.grey,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                        letterSpacing: 1.2,
                      ),
                      floatingLabelBehavior: FloatingLabelBehavior.always,
                      enabledBorder: UnderlineInputBorder(
                        borderSide: BorderSide(
                          color: Colors.grey.shade300,
                          width: 2,
                        ),
                      ),
                      focusedBorder: UnderlineInputBorder(
                        borderSide: BorderSide(color: Colors.black, width: 3),
                      ),
                    );

                    if (type == 'select') {
                      final options = (f['options'] as List<dynamic>? ?? [])
                          .map((e) => e.toString())
                          .toList();
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 24.0),
                        child: DropdownButtonFormField<String>(
                          decoration: decor,
                          dropdownColor: Colors.white,
                          items: options
                              .map(
                                (opt) => DropdownMenuItem(
                                  value: opt,
                                  child: Text(opt),
                                ),
                              )
                              .toList(),
                          onChanged: (val) =>
                              setModalState(() => _checkoutData[apiName] = val),
                        ),
                      );
                    }
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 24.0),
                      child: TextFormField(
                        keyboardType: type == 'number'
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration: decor,
                        onChanged: (val) => _checkoutData[apiName] =
                            type == 'number' ? double.tryParse(val) ?? 0 : val,
                      ),
                    );
                  }).toList(),

                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    height: 64,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: actionColor,
                        foregroundColor: Colors.white,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                        elevation: 0,
                      ),
                      onPressed: isConfirming
                          ? null
                          : () async {
                              final volume = double.tryParse(
                                volumeController.text,
                              );
                              if (volume == null || volume <= 0) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text("Ingresa un volumen válido."),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                                return;
                              }

                              for (var f in fields) {
                                if (f['required'] == true) {
                                  final val = _checkoutData[f['api_name']];
                                  if (val == null ||
                                      val.toString().trim().isEmpty) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(
                                          "El campo ${f['label']} es obligatorio.",
                                        ),
                                        backgroundColor: Colors.red,
                                      ),
                                    );
                                    return;
                                  }
                                }
                              }

                              setModalState(() => isConfirming = true);
                              try {
                                bool success = false;

                                // 🔥 SI ES DEMANDA EJECUTA CUBRIR, SI NO, COMPRAR 🔥
                                if (widget.isDemandMode) {
                                  success = await _marketService.executeFulfill(
                                    demandId: widget.offer['id'],
                                    contractModuleId: targetModuleId,
                                    contractFormId: targetFormId,
                                    volume: volume,
                                    price: double.parse(
                                      widget.precio.toString(),
                                    ),
                                    extraData: _checkoutData,
                                  );
                                } else {
                                  success = await _marketService.executeBuy(
                                    offerId: widget.offer['id'],
                                    contractModuleId: targetModuleId,
                                    contractFormId: targetFormId,
                                    volume: volume,
                                    price: double.parse(
                                      widget.precio.toString(),
                                    ),
                                    extraData: _checkoutData,
                                  );
                                }

                                if (success && ctx.mounted) {
                                  Navigator.pop(ctx);
                                  _showSuccessDialog();
                                }
                              } catch (e) {
                                if (ctx.mounted)
                                  setModalState(() => isConfirming = false);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      e.toString().replaceAll(
                                        'Exception: ',
                                        '',
                                      ),
                                    ),
                                    backgroundColor: Colors.red,
                                  ),
                                );
                              }
                            },
                      child: isConfirming
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Text(
                              widget.isDemandMode
                                  ? 'CONFIRMAR COBERTURA'
                                  : 'CONFIRMAR INTENCIÓN',
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 2.0,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(0)),
        title: const Icon(
          Icons.check_circle_outline,
          color: Colors.black,
          size: 60,
        ),
        content: Text(
          widget.isDemandMode
              ? '¡GRACIAS POR TU COBERTURA!\n\nTu oferta ha sido enviada al comprador. Pronto se pondrán en contacto contigo.'
              : 'INTENCIÓN ENVIADA\n\nTu solicitud de compra ha sido registrada. Pronto nos contactaremos para la firma del contrato.',
          textAlign: TextAlign.center,
        ),
        actions: [
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.black,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.zero,
                ),
              ),
              onPressed: () {
                Navigator.pop(context);
                Navigator.pop(context);
              },
              child: const Text(
                'ENTENDIDO',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
