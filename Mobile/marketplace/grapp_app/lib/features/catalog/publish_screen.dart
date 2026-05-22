import 'dart:convert';
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'market_service.dart';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image/image.dart' as img; // 🔥 NUEVO IMPORT

class PublishScreen extends StatefulWidget {
  final int moduleId;
  final String moduleName;

  const PublishScreen({
    super.key,
    required this.moduleId,
    required this.moduleName,
  });

  @override
  State<PublishScreen> createState() => _PublishScreenState();
}

class _PublishScreenState extends State<PublishScreen> {
  final MarketService _marketService = MarketService();
  bool _isLoadingConfig = true;
  bool _isSubmitting = false;

  int _formId = 0;
  List<dynamic> _wizardConfig = [];
  final Map<String, dynamic> _formData = {};

  @override
  void initState() {
    super.initState();
    _fetchConfig();
  }

  Future<void> _fetchConfig() async {
    try {
      final config = await _marketService.getFormConfigByModule(
        widget.moduleId,
      );
      setState(() {
        _formId = config['form_id'];
        _wizardConfig = config['wizard'];
        _isLoadingConfig = false;
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
      Navigator.pop(context);
    }
  }

  Future<void> _submitPublication() async {
    FocusScope.of(context).unfocus();
    setState(() => _isSubmitting = true);

    try {
      final success = await _marketService.createPublication(
        moduleId: widget.moduleId,
        formId: _formId,
        data: _formData,
      );

      if (success && mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Oferta Publicada con Éxito!'),
            backgroundColor: Colors.black,
          ),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Widget _buildDynamicField(Map<String, dynamic> field) {
    final String apiName =
        field['api_name']?.toString() ?? 'campo_${field.hashCode}';
    final bool isRequired = field['required'] == true || field['required'] == 1;
    final String label =
        (field['label']?.toString() ?? 'Campo') + (isRequired ? ' *' : '');
    final String type = field['type']?.toString() ?? 'text';

    if (type == 'file' ||
        apiName.toLowerCase().contains('imagen') ||
        apiName.toLowerCase().contains('logo')) {
      return GestureDetector(
        onTap: () async {
          final picker = ImagePicker();
          final XFile? imageFile = await picker.pickImage(
            source: ImageSource.gallery,
          );

          if (imageFile != null) {
            Uint8List bytes = await imageFile.readAsBytes();

            // 🔥 COMPRESIÓN MULTIPLATAFORMA (WEB + MÓVIL) 🔥
            // Usamos Dart puro para garantizar que funcione en Chrome
            try {
              img.Image? decodedImage = img.decodeImage(bytes);
              if (decodedImage != null) {
                // Si la imagen es más ancha de 800px, la achicamos
                if (decodedImage.width > 800) {
                  decodedImage = img.copyResize(decodedImage, width: 800);
                }
                // La forzamos a ser JPG con 60% de calidad
                bytes = Uint8List.fromList(
                  img.encodeJpg(decodedImage, quality: 60),
                );
              }
            } catch (e) {
              debugPrint("Error comprimiendo imagen: $e");
            }

            final base64Image = "data:image/jpeg;base64," + base64Encode(bytes);

            setState(() {
              _formData[apiName + "_bytes"] = bytes;
              _formData[apiName] = base64Image;
            });
          }
        },
        child: Container(
          height: 150,
          margin: const EdgeInsets.only(bottom: 24),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F7),
            border: Border.all(
              color: Colors.grey.shade300,
              width: 2,
              style: BorderStyle.solid,
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: _formData[apiName + "_bytes"] != null
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: Image.memory(
                    _formData[apiName + "_bytes"],
                    fit: BoxFit.cover,
                    width: double.infinity,
                  ),
                )
              : Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.camera_alt, color: Colors.black38, size: 40),
                      SizedBox(height: 8),
                      Text(
                        'TOCA PARA SUBIR FOTO',
                        style: TextStyle(
                          fontWeight: FontWeight.w900,
                          color: Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ),
        ),
      );
    }

    // 🔥 SOPORTE AÑADIDO PARA LOS SELECTS EN PUBLISH SCREEN 🔥
    if (type == 'select') {
      final options = (field['options'] as List<dynamic>? ?? [])
          .map((e) => e.toString())
          .toList();
      return Padding(
        padding: const EdgeInsets.only(bottom: 24.0),
        child: DropdownButtonFormField<String>(
          value: _formData[apiName],
          decoration: InputDecoration(
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
          ),
          dropdownColor: Colors.white,
          items: options
              .map((opt) => DropdownMenuItem(value: opt, child: Text(opt)))
              .toList(),
          onChanged: (val) => setState(() => _formData[apiName] = val),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 24.0),
      child: TextFormField(
        keyboardType: type == 'number'
            ? TextInputType.number
            : TextInputType.text,
        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16),
        decoration: InputDecoration(
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
        ),
        onChanged: (val) {
          _formData[apiName] = type == 'number' ? num.tryParse(val) : val;
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'NUEVA OFERTA',
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
      ),
      body: _isLoadingConfig
          ? const Center(child: CircularProgressIndicator(color: Colors.black))
          : Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(24.0),
                    children: [
                      Text(
                        widget.moduleName.toUpperCase(),
                        style: const TextStyle(
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                          height: 1.1,
                          letterSpacing: -1,
                        ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Completa los datos para publicar tu producto en el mercado.',
                        style: TextStyle(color: Colors.black54, fontSize: 14),
                      ),
                      const SizedBox(height: 40),

                      ..._wizardConfig.expand((section) {
                        // 🔥 ESCUDO ANTI NULOS AQUÍ TAMBIÉN 🔥
                        final fields =
                            section['fields'] as List<dynamic>? ?? [];
                        return [
                          Text(
                            section['title'].toString().toUpperCase(),
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Colors.black38,
                              letterSpacing: 2,
                            ),
                          ),
                          const SizedBox(height: 24),
                          ...fields.map((f) => _buildDynamicField(f)).toList(),
                        ];
                      }).toList(),
                    ],
                  ),
                ),

                Container(
                  padding: EdgeInsets.only(
                    left: 24,
                    right: 24,
                    bottom: MediaQuery.of(context).padding.bottom + 16,
                    top: 16,
                  ),
                  color: Colors.white,
                  child: SizedBox(
                    width: double.infinity,
                    height: 60,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.black,
                        foregroundColor: Colors.white,
                        elevation: 0,
                        shape: const RoundedRectangleBorder(
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                      onPressed: _isSubmitting ? null : _submitPublication,
                      child: _isSubmitting
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text(
                              'PUBLICAR OFERTA',
                              style: TextStyle(
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
    );
  }
}
