declare module 'africastalking' {
  interface SmsService { send(options: { to: string[]; message: string; senderId?: string }): Promise<unknown> }
  interface VoiceService { call(options: { callFrom: string; callTo: string; clientRequestId?: string }): Promise<unknown> }
  interface AfricaTalkingClient { SMS: SmsService; VOICE: VoiceService }
  function createClient(credentials: { username?: string; apiKey?: string }): AfricaTalkingClient
  export default createClient
}
