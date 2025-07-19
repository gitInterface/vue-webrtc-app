<template>
  <div class="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6">
    <h1 class="text-3xl font-bold mb-4">🧑‍💻 Vue WebRTC 視訊通話</h1>

    <div class="flex flex-col md:flex-row gap-4">
      <video ref="localVideo" autoplay playsinline muted class="w-64 h-48 bg-black rounded shadow"></video>
      <video ref="remoteVideo" autoplay playsinline class="w-64 h-48 bg-black rounded shadow"></video>
    </div>

    <button @click="startCall" class="mt-6 px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
      開始視訊通話
    </button>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { io } from 'socket.io-client'

const localVideo = ref(null)
const remoteVideo = ref(null)

const socket = io('http://192.168.1.106:3000') // 根據 signaling server 的 IP 設定
let localStream
let peerConnection

const config = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
}

socket.on('offer', async (data) => {
  console.log('[socket] 收到 offer')
  await createPeerConnection()
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
  const answer = await peerConnection.createAnswer()
  await peerConnection.setLocalDescription(answer)
  socket.emit('answer', answer)
  console.log('[socket] 回傳 answer')
})

socket.on('answer', async (data) => {
  console.log('[socket] 收到 answer')
  if (!peerConnection) return
  await peerConnection.setRemoteDescription(new RTCSessionDescription(data))
})

socket.on('ice-candidate', (candidate) => {
  console.log('[socket] 收到 ICE Candidate')
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
  }
})

async function startCall() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    localVideo.value.srcObject = localStream
    console.log('[media] 已取得攝影機與麥克風')
  } catch (err) {
    console.error("無法開啟相機或麥克風：", err)
    return
  }

  await createPeerConnection()

  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream)
  })

  const offer = await peerConnection.createOffer()
  await peerConnection.setLocalDescription(offer)
  socket.emit('offer', offer)
  console.log('[socket] 傳送 offer')
}

async function createPeerConnection() {
  if (peerConnection) return // 防止重複建立

  peerConnection = new RTCPeerConnection(config)

  peerConnection.ontrack = (event) => {
    remoteVideo.value.srcObject = event.streams[0]
    console.log('[peer] 收到遠端影音串流')
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', event.candidate)
      console.log('[peer] 傳送 ICE candidate')
    }
  }
}
</script>

<style scoped>
video {
  object-fit: cover;
}
</style>
