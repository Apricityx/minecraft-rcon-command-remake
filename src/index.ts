import {Context, Schema} from 'koishi'
import Rcon, {RconError} from 'rcon-ts';
import {startVoting} from "./utils/voting";

export const name = 'minecraft-rcon-command-remake'

export interface Config {
  isSelectingServer: boolean
  indexSelectingTimeout: number
  servers: {
    Address: string
    Port: number
    Password?: string
    ServerName?: string
  }[]
  rconConnectingTimeout: number
  whitelistIfSelecting: boolean
  votingEnabled: boolean
  votingTimeout: number
  votingApproveNumber: number
  votingHelpMessage: string
  votingCommand: string
}

export const Config: Schema = Schema.intersect([
  Schema.object({
    isSelectingServer: Schema.boolean().default(true).description('是否在执行命令的时候让执行者选择服务器'),
    rconConnectingTimeout: Schema.number().required().description('RCON连接超时时间(ms)').default(1000).min(10).max(60000),
    indexSelectTimeout: Schema.number().description('选择服务器的超时时间(s)').default(60).min(5).max(600),
  }).description('全局配置'),
  Schema.object({
    whitelistIfSelecting: Schema.boolean().default(false).description('是否在添加白名单的时选择服务器'),
  }).description('白名单指令配置'),
  Schema.object({
    votingEnabled: Schema.boolean().default(false).description('执行Run指令时投票'),
  }).description('投票配置'),
  Schema.union([
    Schema.object({
      votingEnabled: Schema.const(true).required(),
      votingTimeout: Schema.number().description('投票超时时间(s)').default(60).min(10).max(600),
      voteApproveNumber: Schema.number().description('投票通过所需人数').default(3).min(2).max(100),
      voteHelpMessage: Schema.string().description('投票帮助信息').default('使用!!vote yes来同意提议，使用!!vote no来否决提议'),
      votingCommand: Schema.string().description('投票指令').default('!!vote'),
    }),
    Schema.object({}),
  ]),
  Schema.object({
    servers: Schema.array(Schema.object({
      ServerName: Schema.string().description('Display name').default('MyServer'),
      Address: Schema.string().description('Server Address').default('Hypixel.net'),
      Port: Schema.number().description('RCON Port').default(25575).min(1).max(65535),
      Password: Schema.string().description('RCON Password').default('MyPassword'),
    })).role('table').description('服务器列表，请点击右侧的添加行按钮添加服务器信息'),
  }).description('服务器配置'),
])

export function apply(ctx: Context, config: Config) {
  // write your plugin here
  const logger = ctx.logger('minecraft-rcon-command')
  logger.info(config)
  const rcons = config.servers.map(server => new Rcon({
    host: server.Address,
    port: server.Port,
    password: server.Password,
    timeout: config.rconConnectingTimeout
  }))
  ctx.command('!!run <command>')
    .action(async (_, command) => {
      // 保证已指定指令
      if (command === undefined) {
        return `!!run 命令使用方法：!!run &lt;command&gt;\n例如：!!run /list`
      }
      // 消除/
      if (command.startsWith('/')) {
        command = command.substring(1)
      }
      let result = ''
      if (config.isSelectingServer) {
        // 选择服务器的情况
        try {
          if (rcons.length === 0) {
            return '未添加服务器，请在插件配置页面点击servers右侧的添加行按钮添加服务器'
          }
          let selectingMessage = ''
          selectingMessage += `请选择执行指令的服务器: \n`
          for (let i = 0; i < rcons.length; i++) {
            selectingMessage += `[${i}] ${config.servers[i].ServerName}\n`
          }
          _.session.send(selectingMessage)
          const index = await _.session.prompt(config.indexSelectingTimeout)
          // 投票
          if (config.votingEnabled) {
            if (await startVoting(_.session, ctx, `已发起投票，是否向服务器${config.servers[parseInt(index)].ServerName}执行指令:\n${command.startsWith('/') ? command : '/' + command}`, config)) {
              logger.info('投票通过')
            } else {
              return '投票未通过，指令执行终止'
            }
          }
          const rcon = rcons[parseInt(index)]
          await rcon.connect()
          result += await rcon.send(command)
          rcon.disconnect()
        } catch (e) {
          logger.error(e);
          result += `连接失败: ${e}\n`
        }
      } else {
        // 不选择，循环处理所有服务器
        for (const rcon of rcons) {
          result += `${config.servers[rcons.indexOf(rcon)].ServerName}:`
          try {
            // 投票
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
  ctx.command('!!whitelist <action> <player>')
    .action(async (_, action, player) => {
      if (!(action === "add" || action === "remove") || player === undefined) {
        return '!!whitelist 命令使用方法：!!whitelist &lt;add|remove&gt; &lt;player&gt;\n例如：!!whitelist add Notch'
      }
      let result = ''
      if (config.whitelistIfSelecting) {
        try {
          if (rcons.length === 0) {
            return '未添加服务器，请在插件配置页面点击servers右侧的添加行按钮添加服务器'
          }
          let selectingMessage = ''
          selectingMessage += `请选择执行指令的服务器: \n`
          for (let i = 0; i < rcons.length; i++) {
            selectingMessage += `[${i}] ${config.servers[i].ServerName}\n`
          }
          _.session.send(selectingMessage)
          const index = await _.session.prompt(config.indexSelectingTimeout)
          const rcon = rcons[parseInt(index)]
          await rcon.connect()
          result += await rcon.send(`/whitelist ${action} ${player}`)
          rcon.disconnect()
        } catch (e) {
          logger.error(e);
          result += `连接失败: ${e}\n`
        }
      } else {
        for (const rcon of rcons) {
          result += `${config.servers[rcons.indexOf(rcon)].ServerName}:`
          try {
            await rcon.connect()
            result += await rcon.send(`/whitelist ${action} ${player}`)
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
