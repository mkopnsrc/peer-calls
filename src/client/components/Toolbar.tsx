import classnames from 'classnames'
import React from 'react'
import { MdCallEnd, MdShare, MdContentCopy, MdFullscreen, MdFullscreenExit, MdQuestionAnswer, MdScreenShare, MdStopScreenShare, MdLock, MdLockOpen } from 'react-icons/md'
import screenfull from 'screenfull'
import { getDesktopStream } from '../actions/MediaActions'
import { removeLocalStream } from '../actions/StreamActions'
import { DialState, DIAL_STATE_IN_CALL } from '../constants'
import { LocalStream } from '../reducers/streams'
import { callId } from '../window'
import { AudioDropdown, VideoDropdown } from './DeviceDropdown'
import { ToolbarButton } from './ToolbarButton'
import { insertableStreamsCodec } from '../insertable-streams'

export interface ToolbarProps {
  dialState: DialState
  nickname: string
  messagesCount: number
  desktopStream: LocalStream | undefined
  onToggleChat: () => void
  onGetDesktopStream: typeof getDesktopStream
  onRemoveLocalStream: typeof removeLocalStream
  onHangup: () => void
  chatVisible: boolean
}

export interface ToolbarState {
  hidden: boolean
  readMessages: number
  camDisabled: boolean
  micMuted: boolean
  fullScreenEnabled: boolean
  encryptionDialogVisible: boolean
  encrypted: boolean
}

interface ShareData {
  title: string
  text: string
  url: string
}

interface ShareNavigator extends Navigator {
  share: (data: ShareData) => Promise<void>
}

function canShare(navigator: Navigator): navigator is ShareNavigator {
  return 'share' in navigator
}

export default class Toolbar extends React.PureComponent<
  ToolbarProps,
  ToolbarState
> {

  encryptionKeyInputRef: React.RefObject<HTMLInputElement>

  constructor(props: ToolbarProps) {
    super(props)
    this.state = {
      hidden: false,
      readMessages: props.messagesCount,
      camDisabled: false,
      micMuted: false,
      fullScreenEnabled: false,
      encryptionDialogVisible: false,
      encrypted: false,
    }

    this.encryptionKeyInputRef = React.createRef<HTMLInputElement>()
  }
  componentDidMount() {
    document.body.addEventListener('click', this.toggleHidden)
    screenfull.isEnabled && screenfull.on('change', this.fullscreenChange)
  }
  componentDidWillUnmount() {
    document.body.removeEventListener('click', this.toggleHidden)
    screenfull.isEnabled && screenfull.off('change', this.fullscreenChange)
  }
  fullscreenChange = () => {
    this.setState({
      fullScreenEnabled: screenfull.isEnabled && screenfull.isFullscreen,
    })
  }
  toggleHidden = (e: MouseEvent) => {
    const t = e.target && (e.target as HTMLElement).tagName

    if (t === 'DIV' || t === 'VIDEO') {
      this.setState({ hidden: !this.state.hidden })
    }
  }
  handleFullscreenClick = () => {
    if (screenfull.isEnabled) {
      screenfull.toggle()
    }
  }
  handleHangoutClick = () => {
    window.location.href = '/'
  }
  toggleEncryptionDialog = () => {
    const encryptionDialogVisible = !this.state.encryptionDialogVisible

    this.setState({
      encryptionDialogVisible,
    })

    if (encryptionDialogVisible) {
      this.encryptionKeyInputRef.current!.focus()
    }
  }
  setEncryptionKey = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const inputElement = this.encryptionKeyInputRef.current!
    const key = inputElement.value
    inputElement.value = ''

    const encrypted =
      insertableStreamsCodec.setEncryptionKey(key) &&
      key.length > 0

    this.setState({
      encryptionDialogVisible: false,
      encrypted,
    })
  }
  copyInvitationURL = async () => {
    const { nickname } = this.props
    const link = location.href
    const text = `${nickname} has invited you to a meeting on Peer Calls`
    if (canShare(navigator)) {
      await navigator.share({
        title: 'Peer Call',
        text,
        url: link,
      })
      return
    }
    const value = `${text}. \nRoom: ${callId} \nLink: ${link}`
    await navigator.clipboard.writeText(value)
  }
  handleToggleChat = () => {
    this.setState({
      readMessages: this.props.messagesCount,
    })
    this.props.onToggleChat()
  }
  handleToggleShareDesktop = () => {
    if (this.props.desktopStream) {
      const { stream, type } = this.props.desktopStream
      this.props.onRemoveLocalStream(stream, type)
    } else {
      this.props.onGetDesktopStream().catch(() => {})
    }
  }
  render() {
    const { messagesCount } = this.props
    const unreadCount = messagesCount - this.state.readMessages
    const hasUnread = unreadCount > 0
    const isInCall = this.props.dialState === DIAL_STATE_IN_CALL

    const className = classnames('toolbar', {
      'toolbar-hidden': this.props.chatVisible || this.state.hidden,
    })

    const encryptionIcon = this.state.encrypted
      ? MdLock
      : MdLockOpen

    return (
      <React.Fragment>
        <div className={'toolbar-other ' + className}>
          <ToolbarButton
            className='copy-url'
            key='copy-url'
            icon={canShare(navigator) ? MdShare : MdContentCopy}
            onClick={this.copyInvitationURL}
            title={canShare(navigator) ? 'Share' : 'Copy Invitation URL'}
          />
          {isInCall && (
            <React.Fragment>
              <ToolbarButton
                badge={unreadCount}
                className='chat'
                key='chat'
                icon={MdQuestionAnswer}
                blink={!this.props.chatVisible && hasUnread}
                onClick={this.handleToggleChat}
                on={this.props.chatVisible}
                title='Toggle Chat'
              />
            </React.Fragment>
          )}
          <ToolbarButton
            onClick={this.toggleEncryptionDialog}
            key='encryption'
            className={classnames('encryption', {
              'encryption-enabled': this.state.encrypted,
            })}
            on={this.state.encryptionDialogVisible}
            icon={encryptionIcon}
            title='Setup Encryption'
          />
          <form
            className={classnames('encryption-dialog', {
              'encryption-dialog-visible': this.state.encryptionDialogVisible,
            })}
            onSubmit={this.setEncryptionKey}
          >
            <input
              autoComplete='off'
              name='encryption-key'
              className='encryption-key'
              placeholder='Enter Passphrase'
              ref={this.encryptionKeyInputRef}
              type='password'
            />
            <input type='submit' value='Save' />
          </form>

        </div>

        {isInCall && (
          <div className={'toolbar-call ' + className}>
            <ToolbarButton
              className='stream-desktop'
              icon={MdStopScreenShare}
              offIcon={MdScreenShare}
              onClick={this.handleToggleShareDesktop}
              on={!!this.props.desktopStream}
              key='stream-desktop'
              title='Share Desktop'
            />

            <VideoDropdown />

            <ToolbarButton
              onClick={this.props.onHangup}
              key='hangup'
              className='hangup'
              icon={MdCallEnd}
              title='Hang Up'
            />

            <AudioDropdown />

            <ToolbarButton
              onClick={this.handleFullscreenClick}
              className='fullscreen'
              key='fullscreen'
              icon={MdFullscreenExit}
              offIcon={MdFullscreen}
              on={this.state.fullScreenEnabled}
              title='Toggle Fullscreen'
            />

          </div>
        )}
      </React.Fragment>
    )
  }
}
