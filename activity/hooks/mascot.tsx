import type { ClientModule } from 'claude-code'

type State = { tick: number }

const JUMP = [0, 1, 2, 3, 3, 2, 1, 0, 0, 0]
const MAX_HEIGHT = 3

const BODY = [' ▐▛███▜▌ ', '▝▜█████▛▘', '  ▘▘ ▝▝  ']
const EYES_CLOSED = ' ▐▀███▀▌ '
const SQUASHED = ['▗▟█████▙▖', '  ▘▘ ▝▝  ']

const Mascot: ClientModule<{ background: string }, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    surface.setState({ tick: 0 })
    surface.every(110, () => {
      surface.setState({ tick: (surface.state?.tick ?? 0) + 1 })
    })
  }
  const tick = surface.state?.tick ?? 0
  const step = tick % JUMP.length
  const up = JUMP[step] ?? 0
  const isLanding = step === 7
  const isBlinking = tick % 40 >= 38
  const rows = isLanding ? SQUASHED : [isBlinking ? EYES_CLOSED : BODY[0]!, BODY[1]!, BODY[2]!]
  const above = MAX_HEIGHT - up + (isLanding ? 1 : 0)
  const shadow = up >= 2 ? '   ▁▁▁   ' : ' ▁▁▁▁▁▁▁ '

  return (
    <Box flexDirection="column" alignItems="center" width="100%" backgroundColor={props.background || undefined}>
      {Array.from({ length: above }, () => <Text> </Text>)}
      {rows.map(r => <Text color="claude">{r}</Text>)}
      {Array.from({ length: up }, () => <Text> </Text>)}
      <Text color="promptBorder">{shadow}</Text>
    </Box>
  )
}

export default Mascot
