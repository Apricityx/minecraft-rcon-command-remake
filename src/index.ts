import {Context, Schema} from 'koishi'
import Rcon, {RconError} from 'rcon-ts';

export const name = 'minecraft-rcon-command-remake'

export interface Config {
  isSelectingServer: boolean
  servers: {
    Address: string
    Port: number
    Password?: string
    ServerName?: string
  }[]
  rconConnectingTimeout: number
}

export const Config: Schema<Config> = Schema.object({
  isSelectingServer: Schema.boolean().default(true).description('是否在执行命令的时候让执行者选择服务器'),
  rconConnectingTimeout: Schema.number().required().description('RCON连接超时时间(ms)').default(5000).min(1000).max(1000),
  servers: Schema.array(Schema.object({
    ServerName: Schema.string().required().description('Display name').default('MyServer'),
    Address: Schema.string().required().description('Server Address').default('Hypixel.net'),
    Port: Schema.number().required().description('RCON Port').default(25575),
    Password: Schema.string().description('RCON Password').default('MyPassword'),
  })).role('table').description('服务器列表，请点击右侧的添加行按钮添加服务器信息'),
})

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const logger = ctx.logger('minecraft-rcon-command')
  // logger.info(config.servers)
  const rcons = config.servers.map(server => new Rcon({
    host: server.Address,
    port: server.Port,
    password: server.Password,
    timeout: config.rconConnectingTimeout
  }))
  logger.info(rcons)
  ctx.command('run <command>')
    .action(async (_, command) => {
      if (command.startsWith('/')) {
        command = command.substring(1)
      }
      let result = ''
      if (config.isSelectingServer) {
        try {
          // 选择服务器
          let selectingMessage = ''
          selectingMessage += `请选择执行指令的服务器: \n`
          for (let i = 0; i < rcons.length; i++) {
            selectingMessage += `[${i}] ${config.servers[i].ServerName}\n`
          }
          _.session.send(selectingMessage)
          const index = await _.session.prompt()
          const rcon = rcons[parseInt(index)]
          await rcon.connect()
          result += await rcon.send(command)
          rcon.disconnect()
        } catch (e) {
          logger.error(e);
          result += `连接失败: ${e}\n`
        }
      } else {
        // 循环处理所有服务器
        for (const rcon of rcons) {
          result += `${config.servers[rcons.indexOf(rcon)].ServerName}:`
          try {
            await rcon.connect()
            result += await rcon.send(command)
            result += '\n'
            rcon.disconnect()
          } catch (e) {
            logger.error(e)
            result += `连接失败 ${e}\n`
          }
        }
      }
      return result
    })
}
