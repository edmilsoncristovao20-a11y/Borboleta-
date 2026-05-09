package com.borboleta.vpn

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.NotificationCompat
import java.io.FileInputStream
import java.io.FileOutputStream
import java.nio.ByteBuffer

class MeuServicoVPN : VpnService(), Runnable {
    private var vpnInterface: ParcelFileDescriptor? = null
    private var vpnThread: Thread? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.i("MeuServicoVPN", "Iniciando MeuServicoVPN...")
        
        // Android O+ exigem canal de notificação para serviços em primeiro plano
        createNotificationChannel()
        
        val notificationIntent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        val notification = NotificationCompat.Builder(this, "VPN_CHANNEL")
            .setContentTitle("Borboleta VPN Ativa")
            .setContentText("Protegendo sua conexão...")
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentIntent(pendingIntent)
            .build()

        startForeground(1, notification)

        // Inicia a thread de processamento de pacotes
        if (vpnThread == null) {
            vpnThread = Thread(this, "MeuServicoVPNThread")
            vpnThread?.start()
        }
        
        return START_STICKY
    }

    override fun run() {
        try {
            // Configuração da interface da VPN
            val builder = Builder()
            builder.addAddress("10.0.0.2", 32)
            builder.addRoute("0.0.0.0", 0)
            builder.addDnsServer("8.8.8.8")
            builder.setSession("MinhaConexao")
            
            vpnInterface = builder.establish()
            Log.i("MeuServicoVPN", "Interface VPN estabelecida.")

            val input = FileInputStream(vpnInterface?.fileDescriptor)
            val output = FileOutputStream(vpnInterface?.fileDescriptor)
            val packet = ByteBuffer.allocate(32767)

            // Loop de processamento de pacotes
            while (!Thread.interrupted()) {
                val length = input.read(packet.array())
                if (length > 0) {
                    // Aqui seria onde o túnel real (SSH/V2Ray/WG) processaria o pacote
                    // Por agora, apenas simulamos atividade
                    Log.v("MeuServicoVPN", "Pacote capturado: $length bytes")
                    packet.clear()
                }
                Thread.sleep(100) // Evita consumo excessivo de CPU na simulação
            }
        } catch (e: Exception) {
            Log.e("MeuServicoVPN", "Erro no loop da VPN: ${e.message}")
        } finally {
            closeInterface()
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "VPN_CHANNEL",
                "Canal da VPN",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun closeInterface() {
        try {
            vpnInterface?.close()
            vpnInterface = null
        } catch (e: Exception) {
            Log.e("MeuServicoVPN", "Erro ao fechar interface", e)
        }
    }

    override fun onDestroy() {
        vpnThread?.interrupt()
        closeInterface()
        super.onDestroy()
        Log.i("MeuServicoVPN", "VPN encerrada.")
    }
}
