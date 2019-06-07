import React from 'react'
import merge from 'lodash/merge'

export default class ExistingImageWidget extends React.Component {
  constructor (props) {
    super(props)

    this.state = {
      enabled: false,
      data: this.props.blockProps.data.toJS()
    }
  }

  componentDidMount () {
  }

  render () {
    return null
  }
}

export function icon () {
  // https://www.flaticon.com/free-icon/folder_149329#term=folder&page=1&position=43
  return <svg version="1.1" viewBox="0 0 59.911 59.911" width="18px" height="18px" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg">
    <path fill="#494B56" d="m59.605 23.399c-0.241-0.281-0.593-0.443-0.965-0.443h-2.685v-14.233c0-0.975-0.793-1.768-1.768-1.768h-30.665l-2.485-4.141c-0.317-0.53-0.898-0.859-1.516-0.859h-13.798c-0.975 0-1.768 0.793-1.768 1.768v19.232h-2.684c-0.37 0-0.722 0.161-0.963 0.441-0.242 0.28-0.35 0.651-0.294 1.02l4.918 32.461c0.097 0.625 0.625 1.078 1.256 1.078h47.534c0.632 0 1.16-0.453 1.257-1.081l4.917-32.454c0.057-0.367-0.049-0.739-0.291-1.021zm-53.649-19.443h13.434l2.485 4.141c0.317 0.53 0.898 0.859 1.516 0.859h30.565v14h-2v-7h-44v7h-2v-19zm44 19h-40v-5h40v5zm3.14 33h-46.281l-4.696-31h55.674l-4.697 31z"/>
  </svg>
}

export const ExistingImageBlockConfig = (options = {}) => {
  let config = {
    title: 'add an existing image',
    type: 'existing-image',
    icon: icon,
    block: ExistingImageWidget,
    editable: false,
    renderable: false,
    widget_options: {
      displayOnInlineTooltip: true,
      insertion (render) {
        return this.insert_initialized(render)
      },
      insert_block: 'image'
    }
  }

  return merge(config, options)
}

export const getAspectRatio = (w, h) => {
  let maxWidth = 1000
  let maxHeight = 1000
  let ratio = 0
  let width = w // Current image width
  let height = h // Current image height

  if (width > maxWidth) {
    // Check if the current width is larger than the max
    ratio = maxWidth / width // get ratio for scaling image
    height = height * ratio // Reset height to match scaled image
    width = width * ratio // Reset width to match scaled image
  } else if (height > maxHeight) {
    // Check if current height is larger than max
    ratio = maxHeight / height // get ratio for scaling image
    width = width * ratio // Reset width to match scaled image
    height = height * ratio // Reset height to match scaled image
  }

  let fillRatio = height / width * 100
  return { width, height, ratio: fillRatio }
}
