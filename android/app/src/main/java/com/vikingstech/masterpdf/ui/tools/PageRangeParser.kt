package com.vikingstech.masterpdf.ui.tools

/**
 * Parses a 1-based page-range spec like `"1-3,5,8-10"` into sorted, distinct
 * 0-based page indices, clamped to the document's bounds. A blank spec means
 * "all pages". Reversed ranges (`"5-3"`) and out-of-range numbers are tolerated.
 * Pure and dependency-free so it can be unit tested directly.
 */
object PageRangeParser {

    fun parse(spec: String, pageCount: Int): List<Int> {
        if (pageCount <= 0) return emptyList()
        val trimmed = spec.trim()
        if (trimmed.isEmpty()) return (0 until pageCount).toList()

        val result = sortedSetOf<Int>()
        for (part in trimmed.split(",")) {
            val token = part.trim()
            if (token.isEmpty()) continue
            if (token.contains("-")) {
                val bits = token.split("-")
                val a = bits.getOrNull(0)?.trim()?.toIntOrNull()
                val b = bits.getOrNull(1)?.trim()?.toIntOrNull()
                if (a != null && b != null) {
                    for (n in minOf(a, b)..maxOf(a, b)) addOneBased(result, n, pageCount)
                }
            } else {
                token.toIntOrNull()?.let { addOneBased(result, it, pageCount) }
            }
        }
        return result.toList()
    }

    private fun addOneBased(set: MutableSet<Int>, oneBased: Int, pageCount: Int) {
        val index = oneBased - 1
        if (index in 0 until pageCount) set.add(index)
    }
}
