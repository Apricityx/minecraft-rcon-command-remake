import {group} from 'console'
import {Context, Schema} from 'koishi'
import {sleep} from 'koishi';

// import {Config} from "../index";

export async function startVoting(session: any, ctx: any, message: string, config: any): Promise<boolean> {
  const logger = ctx.logger('minecraft-rcon-command')
  const votingGroup = {}
  const helpMessage = config.voteHelpMessage
  const ProgressMessageConstructor = (AgreeNum: number) => {
    let message = ''
    for (let i = 0; i < AgreeNum; i++) {
      if (i === config.voteApproveNumber - 1) {
        message += '◆ '
      } else {
        message += '◆ '
      }
    }
    for (let i = AgreeNum; i < config.voteApproveNumber; i++) {
      if (i === config.voteApproveNumber - 1) {
        message += '◇'
      } else {
        message += '◇ '
      }
    }
    return message
  }
  const GroupNum = session.guildId

  enum VoteStatus {
    Agree,
    Disagree,
    Pending
  }

  const voteInfo = {
    votedPerson: [],
    agreeNum: 1,
    disagreeNum: 0,
    voteStatus: VoteStatus.Pending
  }
  voteInfo.votedPerson.push(session.userId)
  session.send(message + '\n' + helpMessage + '\n' + ProgressMessageConstructor(1))
  if (votingGroup[GroupNum] === 'voting') {
    session.send(`当前群聊已经有人发起了投票，请等待投票结束后再发起新的投票，或使用${config.votingCommand} no取消投票`)
    return
  }
  logger.info(GroupNum + '发起了一次投票')
  votingGroup[GroupNum] = 'voting'
  //Todo 未实现单个群聊不能重复发起投票的限制

  const dispose = ctx.middleware(async (session: any, next: any) => {
    logger.info(session.content + session.guildId)
    if (session.guildId === GroupNum) {
      if (voteInfo.votedPerson.includes(session.userId)) {
        session.send('您已经投过票了')
        return next()
      }
      const split_message = session.content.split(' ')
      // logger.info(split_message)
      if (split_message === undefined) {
        return next()
      } else if (split_message[0] === config.votingCommand) {
        if (split_message[1] === 'yes') {
          voteInfo.agreeNum++
          voteInfo.votedPerson.push(session.userId)
          session.send(message + '\n' + helpMessage + '\n' + ProgressMessageConstructor(voteInfo.agreeNum))
          if (voteInfo.agreeNum >= config.voteApproveNumber) {
            voteInfo.voteStatus = VoteStatus.Agree
            return next()
          } else {
            return next()
          }
        } else if (split_message[1] === 'no') {
          voteInfo.disagreeNum++
          voteInfo.voteStatus = VoteStatus.Disagree
        } else {
          session.send('请输入正确的指令')
          return next()
        }
      }
    }
    return next()
  })
  while (voteInfo.voteStatus === VoteStatus.Pending) {
    await sleep(1000)
  }
  if (voteInfo.voteStatus === VoteStatus.Disagree) {
    session.send('投票未通过')
    dispose()
    votingGroup[GroupNum] = 'unvoting'
    return false
  } else {
    session.send('投票通过')
    dispose()
    votingGroup[GroupNum] = 'unvoting'
    return true
  }
}
