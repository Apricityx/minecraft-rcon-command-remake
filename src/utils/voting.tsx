import {group} from 'console'
import {Context, Schema} from 'koishi'
import {sleep} from 'koishi';

// import {Config} from "../index";
const votingGroup = {}

export async function startVoting(session: any, ctx: any, message: string, config: any): Promise<boolean> {
  if (config.checkAllowedGroup) {
    const logger = ctx.logger('minecraft-rcon-command')
    logger.info(config.allowedGroups)
    if (!config.allowedGroups.includes(session.guildId)) {
      session.send(
        <>
          <quote id={(session.messageId).toString()}/>
          <at id={session.userId}/>
          {" "}
          {config.refusedText}
        </>
      )
      return false
    }
  }
  const logger = ctx.logger('minecraft-rcon-command')
  const helpMessage = config.voteHelpMessage.replace(/\\n/g, '\n')
  // 处理\n的转义
  const ProgressMessageConstructor = (AgreeNum: number) => {
    let message = '投票进度：'
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
  if (votingGroup[GroupNum] === 'voting') {
    session.send(<>
      <quote id={(session.messageId).toString()}/>
      <at id={session.userId}/>
      {" "}
      当前群聊已经有人发起了投票，请等待投票结束后再发起新的投票，或使用{config.votingCommand} no取消投票
    </>)
    return
  }
  session.send(message + '\n' + helpMessage + '\n' + ProgressMessageConstructor(1))
  logger.info(GroupNum + '发起了一次投票')
  votingGroup[GroupNum] = 'voting'

  const dispose = ctx.middleware(async (session: any, next: any) => {
      // logger.info(session.content + session.guildId)
      if (session.guildId === GroupNum) {
        if (voteInfo.votedPerson.includes(session.userId)) {
          if (session.content.startsWith(config.votingCommand)) {
            session.send(<>
              <quote id={(session.messageId).toString()}/>
              <at id={session.userId}/>
              {" "}
              你已经投过票了
            </>)
          }
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
            if (voteInfo.agreeNum >= config.voteApproveNumber) {
              voteInfo.voteStatus = VoteStatus.Agree
              session.send(
                <>
                  <quote id={(session.messageId).toString()}/>
                  <at id={session.userId}/>
                  {message + '\n' + helpMessage + '\n' + ProgressMessageConstructor(voteInfo.agreeNum) + '\n投票通过，正在执行'}
                </>
              )
              return next()
            } else {
              session.send(message + '\n' + helpMessage + '\n' + ProgressMessageConstructor(voteInfo.agreeNum))
              return next()
            }
          } else if (split_message[1] === 'no') {
            voteInfo.disagreeNum++
            voteInfo.voteStatus = VoteStatus.Disagree
          } else {
            session.send('请输入正确的指令\n' + helpMessage)
            return next()
          }
        }
      }
      return next()
    }
  )
  let timeCounter = 0
  while (voteInfo.voteStatus === VoteStatus.Pending) {
    await sleep(1000)
    timeCounter++
    if (timeCounter >= config.voteTimeOut) {
      session.send('投票超时')
      dispose()
      votingGroup[GroupNum] = 'unvoting'
      logger.info('群聊' + GroupNum + '投票超时')
      return false
    }
  }
  if (voteInfo.voteStatus === VoteStatus.Disagree) {
    // logger.log('投票未通过')
    dispose()
    votingGroup[GroupNum] = 'unvoting'
    logger.info('群聊' + GroupNum + '投票未通过')
    return false
  } else {
    // session.send('投票通过')
    dispose()
    votingGroup[GroupNum] = 'unvoting'
    logger.info('群聊' + GroupNum + '投票通过')
    return true
  }
}
