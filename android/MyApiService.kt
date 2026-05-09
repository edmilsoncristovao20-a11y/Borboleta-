package com.borboleta.vpn

import retrofit2.http.GET

interface MyApiService {
    @GET("posts")
    suspend fun fetchLatestPosts(): List<Post>
}
