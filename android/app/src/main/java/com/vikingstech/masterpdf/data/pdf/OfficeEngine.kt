package com.vikingstech.masterpdf.data.pdf

import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/** Which Office family an import/export targets. */
enum class OfficeKind { WORD, POWERPOINT, EXCEL }

/**
 * Office-format interop without a heavyweight library (Apache POI doesn't run
 * cleanly on Android). Word (.docx) and Excel (.xlsx) are written as spec-valid
 * minimal OOXML packages by hand; reading Office files extracts their text by
 * unzipping the package and pulling the run/cell text out of the part XML.
 *
 * PowerPoint authoring (.pptx) needs a large web of related parts to be valid,
 * so PDF→PowerPoint is exported as an image package (.zip, one image per slide)
 * via [zipFiles] — documented as a known limitation rather than risk emitting a
 * malformed presentation.
 */
object OfficeEngine {

    // ── writers ──────────────────────────────────────────────────────────────

    /** Minimal valid .docx: one paragraph per input line. */
    fun writeDocx(paragraphs: List<String>, destination: File) {
        val body = buildString {
            val lines = paragraphs.ifEmpty { listOf("") }
            for (p in lines) {
                append("<w:p><w:r><w:t xml:space=\"preserve\">")
                append(xmlEscape(p))
                append("</w:t></w:r></w:p>")
            }
            append("<w:sectPr/>")
        }
        val document =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">" +
                "<w:body>" + body + "</w:body></w:document>"

        val contentTypes =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>" +
                "</Types>"

        val rels =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>" +
                "</Relationships>"

        writeZip(
            destination,
            linkedMapOf(
                "[Content_Types].xml" to contentTypes,
                "_rels/.rels" to rels,
                "word/document.xml" to document
            )
        )
    }

    /** Minimal valid .xlsx: one sheet, inline-string cells. */
    fun writeXlsx(rows: List<List<String>>, destination: File) {
        val sheetData = buildString {
            val data = rows.ifEmpty { listOf(listOf("")) }
            data.forEachIndexed { r, row ->
                append("<row r=\"").append(r + 1).append("\">")
                row.forEachIndexed { c, value ->
                    append("<c r=\"").append(columnName(c)).append(r + 1)
                        .append("\" t=\"inlineStr\"><is><t xml:space=\"preserve\">")
                    append(xmlEscape(value))
                    append("</t></is></c>")
                }
                append("</row>")
            }
        }
        val sheet =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<worksheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">" +
                "<sheetData>" + sheetData + "</sheetData></worksheet>"

        val workbook =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" " +
                "xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\">" +
                "<sheets><sheet name=\"Sheet1\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>"

        val workbookRels =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/>" +
                "</Relationships>"

        val contentTypes =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">" +
                "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>" +
                "<Default Extension=\"xml\" ContentType=\"application/xml\"/>" +
                "<Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/>" +
                "<Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/>" +
                "</Types>"

        val rels =
            "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>" +
                "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">" +
                "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/>" +
                "</Relationships>"

        writeZip(
            destination,
            linkedMapOf(
                "[Content_Types].xml" to contentTypes,
                "_rels/.rels" to rels,
                "xl/workbook.xml" to workbook,
                "xl/_rels/workbook.xml.rels" to workbookRels,
                "xl/worksheets/sheet1.xml" to sheet
            )
        )
    }

    /** Bundle arbitrary files into a flat .zip (used for the slide-image package). */
    fun zipFiles(files: List<File>, destination: File) {
        ZipOutputStream(destination.outputStream().buffered()).use { zos ->
            for (file in files) {
                zos.putNextEntry(ZipEntry(file.name))
                file.inputStream().use { it.copyTo(zos) }
                zos.closeEntry()
            }
        }
    }

    // ── reader ────────────────────────────────────────────────────────────────

    /**
     * Extract readable text from an Office file. Recognises OOXML (.docx/.pptx/
     * .xlsx) packages, RTF, and plain text/CSV. Legacy binary .doc/.ppt/.xls are
     * not supported and surface as empty text (the caller reports it).
     */
    fun extractText(file: File, kind: OfficeKind): String {
        if (isZip(file)) {
            return when (kind) {
                OfficeKind.WORD -> wordText(readEntry(file, "word/document.xml"))
                OfficeKind.POWERPOINT -> extractSlides(file)
                OfficeKind.EXCEL -> extractSpreadsheet(file)
            }
        }
        val raw = runCatching { file.readText() }.getOrDefault("")
        return if (raw.trimStart().startsWith("{\\rtf")) stripRtf(raw) else raw
    }

    // ── internals ──────────────────────────────────────────────────────────────

    private fun extractSlides(file: File): String {
        ZipFile(file).use { zip ->
            val slideRegex = Regex("ppt/slides/slide(\\d+)\\.xml")
            val slides = zip.entries().asSequence()
                .mapNotNull { e -> slideRegex.matchEntire(e.name)?.let { it.groupValues[1].toInt() to e } }
                .sortedBy { it.first }
                .toList()
            return slides.joinToString("\n\n") { (_, entry) ->
                val xml = zip.getInputStream(entry).bufferedReader().use { it.readText() }
                tagText(xml, "a:t").joinToString(" ")
            }
        }
    }

    private fun extractSpreadsheet(file: File): String {
        ZipFile(file).use { zip ->
            val shared = zip.getEntry("xl/sharedStrings.xml")?.let { e ->
                val xml = zip.getInputStream(e).bufferedReader().use { it.readText() }
                Regex("<si>(.*?)</si>", RegexOption.DOT_MATCHES_ALL).findAll(xml)
                    .map { si -> tagText(si.groupValues[1], "t").joinToString("") }
                    .toList()
            } ?: emptyList()

            val sheetEntry = zip.entries().asSequence()
                .filter { it.name.matches(Regex("xl/worksheets/sheet\\d+\\.xml")) }
                .sortedBy { it.name }
                .firstOrNull() ?: return ""
            val xml = zip.getInputStream(sheetEntry).bufferedReader().use { it.readText() }

            return Regex("<row[^>]*>(.*?)</row>", RegexOption.DOT_MATCHES_ALL).findAll(xml)
                .joinToString("\n") { rowMatch ->
                    Regex("<c[^>]*?(?:\\st=\"(\\w+)\")?[^>]*>(.*?)</c>", RegexOption.DOT_MATCHES_ALL)
                        .findAll(rowMatch.groupValues[1])
                        .joinToString("\t") { cell ->
                            val type = cell.groupValues[1]
                            val inner = cell.groupValues[2]
                            when (type) {
                                "s" -> tagText(inner, "v").firstOrNull()?.toIntOrNull()
                                    ?.let { shared.getOrNull(it) } ?: ""
                                "inlineStr" -> tagText(inner, "t").joinToString("")
                                else -> tagText(inner, "v").firstOrNull() ?: ""
                            }
                        }
                }
        }
    }

    /** WordprocessingML to text: one line per paragraph, joining its runs. */
    private fun wordText(xml: String): String =
        xml.split("</w:p>")
            .joinToString("\n") { para -> tagText(para, "w:t").joinToString("") }
            .trim()

    private fun tagText(xml: String, tag: String): List<String> =
        Regex("<$tag[^>]*>(.*?)</$tag>", RegexOption.DOT_MATCHES_ALL)
            .findAll(xml)
            .map { xmlUnescape(it.groupValues[1]) }
            .toList()

    private fun readEntry(file: File, entryName: String): String =
        ZipFile(file).use { zip ->
            zip.getEntry(entryName)?.let { e ->
                zip.getInputStream(e).bufferedReader().use { it.readText() }
            } ?: ""
        }

    private fun isZip(file: File): Boolean = runCatching {
        file.inputStream().use { ins ->
            val b = ByteArray(2)
            ins.read(b) == 2 && b[0] == 'P'.code.toByte() && b[1] == 'K'.code.toByte()
        }
    }.getOrDefault(false)

    private fun stripRtf(s: String): String =
        s.replace(Regex("\\\\par[d]?\\b"), "\n")
            .replace(Regex("\\\\'[0-9a-fA-F]{2}"), "")
            .replace(Regex("\\\\[a-zA-Z]+-?\\d* ?"), "")
            .replace("{", "")
            .replace("}", "")
            .trim()

    private fun writeZip(destination: File, entries: Map<String, String>) {
        ZipOutputStream(destination.outputStream().buffered()).use { zos ->
            for ((name, content) in entries) {
                zos.putNextEntry(ZipEntry(name))
                zos.write(content.toByteArray(Charsets.UTF_8))
                zos.closeEntry()
            }
        }
    }

    private fun columnName(index: Int): String {
        var i = index
        val sb = StringBuilder()
        while (i >= 0) {
            sb.insert(0, ('A' + (i % 26)))
            i = i / 26 - 1
        }
        return sb.toString()
    }

    private fun xmlEscape(s: String): String = buildString {
        for (c in s) when (c) {
            '&' -> append("&amp;")
            '<' -> append("&lt;")
            '>' -> append("&gt;")
            '"' -> append("&quot;")
            '\'' -> append("&apos;")
            else -> if (c.code < 0x20 && c != '\t') append(' ') else append(c)
        }
    }

    private fun xmlUnescape(s: String): String =
        s.replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"")
            .replace("&apos;", "'")
}
