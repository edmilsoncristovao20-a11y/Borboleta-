package com.borboleta.vpn

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "posts")
data class Post(
    @PrimaryKey val id: Int,
    val titulo: String,
    val conteudo: String
)
