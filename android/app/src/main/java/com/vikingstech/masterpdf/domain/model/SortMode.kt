package com.vikingstech.masterpdf.domain.model

/** Ordering options for the Home screen's recent-document list. */
enum class SortMode {
    /** Most recently opened first (pinned still float to the top). */
    RECENT,

    /** Pinned documents only. */
    PINNED,

    /** Largest file size first. */
    LARGEST,

    /** Smallest file size first. */
    SMALLEST,

    /** Alphabetical by display name. */
    AZ
}
