package com.vikingstech.masterpdf.domain.model

/** Where stamped page numbers are placed. */
enum class PageNumberPlacement { BOTTOM_CENTER, BOTTOM_RIGHT, TOP_CENTER, TOP_RIGHT }

/** Office family for import (→PDF) and export (PDF→) conversions. */
enum class OfficeFormat { WORD, POWERPOINT, EXCEL }

/** Raster format for the image conversion tools. */
enum class ImageOutputFormat { JPEG, PNG }
