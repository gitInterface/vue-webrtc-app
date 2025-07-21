<template>
  <div class="min-h-screen bg-gray-100 flex flex-col pt-6 pb-32 px-4 relative">
    <h1 class="text-3xl font-bold mb-4 text-center">🧑‍💻 Vue WebRTC 視訊通話</h1>

    <!-- 視訊畫面：手機直排 / 桌機橫排 -->
    <div class="flex flex-wrap md:flex-row w-full gap-4">
      <div class="relative w-full md:w-[45%] h-[40vh] md:h-[60vh]">
        <video ref="localVideo" class="w-[45%] h-full bg-black rounded-xl shadow" autoplay playsinline muted></video>
        <button v-if="localStream" @click="enterFullscreen(localVideo.value)"
          class="absolute bottom-2 right-2 bg-white bg-opacity-70 text-black text-base px-4 py-2 rounded-xl hover:bg-opacity-90 shadow transition">
          ⛶ 全螢幕
        </button>
      </div>
      <div class="relative w-full md:w-[45%] h-[40vh] md:h-[60vh]">
        <video ref="remoteVideo" class="w-[45%] h-full bg-black rounded-xl shadow" autoplay playsinline></video>
        <button v-if="localStream" @click="enterFullscreen(remoteVideo.value)"
          class="absolute bottom-2 right-2 bg-white bg-opacity-70 text-black text-base px-4 py-2 rounded-xl hover:bg-opacity-90 shadow transition">
          ⛶ 全螢幕
        </button>
      </div>
    </div>
    <div class="border-t border-dashed border-gray-300 w-screen absolute bottom-6 z-40"></div>
    <!-- 浮動按鈕列 -->
    <div
      class="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white px-8 py-5 rounded-full shadow-xl flex gap-6 z-50">
      <button @click="startCall"
        class="px-8 py-4 text-xl font-semibold bg-gradient-to-r from-green-500 to-green-700 text-white rounded-full shadow hover:from-green-600 hover:to-green-800 transition">
        📞 開啟通話
      </button>
      <button @click="endCall"
        class="px-8 py-4 text-xl font-semibold bg-gradient-to-r from-red-500 to-red-700 text-white rounded-full shadow hover:from-red-600 hover:to-red-800 transition">
        🔕 結束通話
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
