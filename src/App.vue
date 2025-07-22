<template>
  <div class="min-h-screen bg-gray-100 flex flex-col pt-6 pb-32 px-4 relative">
    <h1 class="text-3xl font-bold mb-6 text-center">🧑‍💻 Vue WebRTC 視訊通話</h1>

    <!-- 視訊畫面 -->
    <div class="flex flex-row flex-wrap gap-4 w-full">
      <!-- 本地視訊 -->
      <div class="w-full sm:w-[45%] max-w-[480px] aspect-video relative">
        <video ref="localVideo" class="w-full h-full object-cover bg-black rounded-xl shadow" autoplay playsinline
          muted></video>
      </div>

      <!-- 遠端視訊 -->
      <div class="w-full sm:w-[45%] max-w-[480px] aspect-video relative">
        <video ref="remoteVideo" class="w-full h-full object-cover bg-black rounded-xl shadow" autoplay
          playsinline></video>
      </div>
    </div>

    <!-- 浮動按鈕列 -->
    <div
      class="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-white px-10 py-6 rounded-full shadow-2xl flex gap-10 z-50">
      <button @click="startCall"
        class="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 text-white text-2xl flex items-center justify-center shadow-xl transition">
        📞開啟通話
      </button>
      <button @click="endCall"
        class="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white text-2xl flex items-center justify-center shadow-xl transition">
        🔕結束通話
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue'
import { io } from 'socket.io-client'

const localVideo = ref(null)
const remoteVideo = ref(null)

const socket = io('https://signaling-server-8zqh.onrender.com') // 根據 signaling server 的 IP 設定
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
    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 480 },
        height: { ideal: 270 }
      },
      audio: true
    })
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

async function endCall() {
  try {
    // 關閉 PeerConnection
    if (peerConnection) {
      peerConnection.close()
      peerConnection = null
    }

    // 停用本地串流
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
      localStream = null
    }

    // 清空 video DOM 元素
    if (localVideo.value) localVideo.value.srcObject = null
    if (remoteVideo.value) remoteVideo.value.srcObject = null

    // 通知其他用戶通話結束
    socket.emit('end-call')
  } catch (err) {
    console.error('結束通話時發生錯誤：', err)
  }
}

function enterFullscreen(el) {
  if (!el) return
  if (el.requestFullscreen) {
    el.requestFullscreen()
  } else if (el.webkitRequestFullscreen) {
    el.webkitRequestFullscreen()
  } else if (el.msRequestFullscreen) {
    el.msRequestFullscreen()
  }
}

socket.on('end-call', () => {
  endCall()
})

onBeforeUnmount(() => {
  endCall()
  socket.disconnect()
})
</script>

<style scoped>
video {
  object-fit: cover;
}
</style>
