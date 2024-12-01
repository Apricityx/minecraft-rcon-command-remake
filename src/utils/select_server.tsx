export const selectServer = async (session: any, ctx: any, config: any, rcons: any) => {
  if (rcons.length === 1) {
    // 只有一个服务器，无需选择
    return 0;
  }
  if (rcons.length === 0) {
    session.send('未添加服务器，请在插件配置页面点击servers右侧的添加行按钮添加服务器')
    return undefined
  }
  let selectingMessage = ''
  selectingMessage += `请选择执行指令的服务器: \n`
  for (let i = 0; i < rcons.length; i++) {
    selectingMessage += `[${i}] ${config.servers[i].ServerName}\n`
  }
  session.send(selectingMessage)
  let index: number = undefined;
  index = await session.prompt(config.indexSelectingTimeout)
  if (index >= 0 && index < rcons.length) {
    return index;
  } else {
    await session.send(<>
      <at id={session.userId}/>
      <quote id={(session.messageId).toString()}/>
      {" "}
      输入的数字不在范围内，请输入0-{rcons.length - 1}选择服务器
    </>)
    return undefined
  }
}
