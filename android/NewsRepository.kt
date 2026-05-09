package com.borboleta.vpn

import android.util.Log
import kotlinx.coroutines.flow.Flow

class NewsRepository(private val postDao: PostDao, private val api: MyApiService) {

    // A UI observa esta variável. Ela sempre terá os dados do banco local.
    val allPosts: Flow<List<Post>> = postDao.getAllPosts()

    suspend fun refreshPosts() {
        try {
            // Tenta buscar na internet
            val response = api.fetchLatestPosts()
            // Se tiver sucesso, salva no banco local (sobrescrevendo o antigo)
            postDao.savePosts(response)
        } catch (e: Exception) {
            // Se falhar (sem internet), o app não quebra. 
            // O usuário continua vendo os dados antigos salvos no banco.
            Log.e("OfflineMode", "Sem conexão. Exibindo dados locais.", e)
        }
    }
}
