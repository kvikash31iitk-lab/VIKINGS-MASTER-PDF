package com.vikingstech.masterpdf.domain.util

/**
 * A platform-agnostic result wrapper used across the domain boundary so callers
 * never have to reason about thrown exceptions on the happy path.
 */
sealed interface Resource<out T> {
    data class Success<T>(val data: T) : Resource<T>
    data class Error(val message: String, val cause: Throwable? = null) : Resource<Nothing>
    data object Loading : Resource<Nothing>
}

inline fun <T> Resource<T>.onSuccess(block: (T) -> Unit): Resource<T> {
    if (this is Resource.Success) block(data)
    return this
}

inline fun <T> Resource<T>.onError(block: (String, Throwable?) -> Unit): Resource<T> {
    if (this is Resource.Error) block(message, cause)
    return this
}

fun <T> Resource<T>.getOrNull(): T? = (this as? Resource.Success)?.data
