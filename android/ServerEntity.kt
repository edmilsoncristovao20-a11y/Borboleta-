package com.borboleta.vpn

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "servers")
data class ServerEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Int = 0,
    val serverId: String,
    val name: String,
    val host: String,
    val port: Int,
    val type: String,
    val sni: String,
    val isGlobal: Boolean,
    var status: String = "online"
)
