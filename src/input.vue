<template>
  <div
    ref="input"
    :class="[{ fullscreen: distractionFree }, 'interface-wysiwyg-modern-container', {readonly: readonly}]">

    <!-- Existing image modal -->
    <portal
      v-if="!readonly && chooseExisting"
      to="modal">
      <v-modal
        :title="$t('choose_one')"
        :buttons="{
          done: {
            text: $t('done'),
            loading: loadingExistingImage
          }
        }"
        @close="chooseExisting = false"
        @done="chooseExisting = false"
      >
        <v-items
          :selection="[]"
          :view-options="chooseExistingViewOptions"
          collection="directus_files"
          view-type="cards"
          @select="insertExistingImage($event[0])"
        />
      </v-modal>
    </portal>

    <!-- Distraction free button -->
    <button
      v-tooltip="$t('interfaces-wysiwyg-modern-distraction_free_mode')"
      type="button"
      class="fullscreen-toggle"
      @click="distractionFree = !distractionFree"
    >
      <v-icon :name="fullscreenIcon" />
    </button>

    <!-- Dante2 component -->
    <react-wrapper
      ref="editor"
      :key="editorKey"
      :component="DanteEditor"
      :widgets="enabledWidgets()"
      :tooltips="enabledTooltips()"
      :character_convert_mapping="characterConvertMapping()"
      :content="value"
      :body_placeholder="options.placeholder || $t('interfaces-wysiwyg-modern-placeholder_default')"
      :read_only="readonly"
      class="interface-wysiwyg"
      @onChange="onChange" />

  </div>
</template>

<script>
import mixin from '@directus/extension-toolkit/mixins/interface'
import { ReactWrapper } from 'vuera'
import focusWithin from 'focus-within-polyfill'

// Dante 2
import DanteEditor from 'Dante2'
import { resetBlockWithType } from 'Dante2/package/es/model/index.js'
import icons from 'Dante2/package/es/components/icons.js'

// Dante 2 Widgets
import { PlaceholderBlockConfig } from 'Dante2/package/es/components/blocks/placeholder.js'
import { ImageBlockConfig } from 'Dante2/package/es/components/blocks/image.js'
import { VideoBlockConfig } from 'Dante2/package/es/components/blocks/video.js'
import { EmbedBlockConfig } from 'Dante2/package/es/components/blocks/embed.js'
import { DividerBlockConfig } from 'Dante2/package/es/components/blocks/divider.js'
import { ExistingImageBlockConfig, getAspectRatio } from './blocks/existingImage.js'

// Dante 2 tooltips
import { DanteImagePopoverConfig } from 'Dante2/package/es/components/popovers/image.js'
import { DanteAnchorPopoverConfig } from 'Dante2/package/es/components/popovers/link.js'
import { DanteInlineTooltipConfig } from './popovers/addButton.js'
import { DanteTooltipConfig } from 'Dante2/package/es/components/popovers/toolTip.js'

const EXISTING_IMAGE_INSERTION_EVENT = 'interface::wysiwyg-dante2::insert_existing_image'

// Activate polyfills
focusWithin.polyfill()

export default {
  name: 'InterfaceWysiwyg',
  components: {
    ReactWrapper
  },
  mixins: [mixin],
  data () {
    return {
      DanteEditor,
      editorKey: 'fullscreen-off',
      distractionFree: false,
      chooseExisting: false,
      chooseExistingViewOptions: {
        title: 'title',
        subtitle: 'type',
        content: 'description',
        src: 'data'
      },
      chooseExistingListener: null,
      loadingExistingImage: false
    }
  },
  computed: {
    fullscreenIcon () {
      return this.distractionFree ? 'close' : 'fullscreen'
    }
  },
  watch: {
    distractionFree (on) {
      if (on) {
        this.$helpers.disableBodyScroll(this.$refs.input)
        this.editorKey = 'fullscreen-on'
      } else {
        this.$helpers.enableBodyScroll(this.$refs.input)
        this.editorKey = 'fullscreen-off'
      }
    },
    chooseExisting (val) {
      if (val === false) {
        this.$off(this.chooseExistingListener)
      }
    }
  },
  mounted () {
  },
  methods: {
    // Dante 2 widgets
    PlaceholderBlockConfig () {
      return PlaceholderBlockConfig()
    },
    ImageBlockConfig () {
      return ImageBlockConfig({
        options: {
          image_caption_placeholder: this.options.default_image_caption || this.$t('interfaces-wysiwyg-modern-default_image_caption_default'),
          upload_handler: async (file, imageBlock) => {
            try {
              const url = await this.uploadImage(file)
              imageBlock.uploadCompleted(url)
            } catch (err) {
              imageBlock.uploadFailed()

              this.$events.emit('error', {
                notify: this.$t('interfaces-wysiwyg-modern-upload_image_error'),
                error: err
              })

              const { blockProps } = imageBlock.props
              const { getEditorState, setEditorState } = blockProps

              return setEditorState(resetBlockWithType(getEditorState(), 'unstyled', {}))
            }
          }
        }
      })
    },
    ExistingImageBlockConfig () {
      return ExistingImageBlockConfig({
        widget_options: {
          insert_initialized: (render) => {
            const vm = this

            // Open the selection modal.
            this.chooseExisting = true

            // React once an image is chosen.
            this.chooseExistingListener = vm.$on(EXISTING_IMAGE_INSERTION_EVENT, (image) => {
              vm.loadingExistingImage = true

              let url = image.data.full_url
              if (vm.options.custom_images_url) {
                url = `${vm.options.custom_images_url}${image.filename}`
              }

              // Load the image and render a block with it.
              const loadedImage = new Image()

              loadedImage.onload = function () {
                render('image', {
                  url,
                  width: this.width,
                  height: this.height,
                  aspect_ratio: getAspectRatio(this.width, this.height)
                })

                // Close the modal.
                vm.chooseExisting = false
                vm.loadingExistingImage = false
              }

              // Display an error if the image was not loaded.
              loadedImage.onerror = function (err) {
                vm.$events.emit('error', {
                  notify: vm.$t('interfaces-wysiwyg-modern-existing_image_error'),
                  error: err
                })

                vm.loadingExistingImage = false
              }

              loadedImage.src = url
            })
          }
        }
      })
    },
    VideoBlockConfig () {
      return VideoBlockConfig({
        options: {
          endpoint: this.options.video_embed_endpoint || '//noembed.com/embed?url=',
          placeholder: this.options.video_embed_placeholder || this.$t('interfaces-wysiwyg-modern-video_embed_placeholder_default'),
          caption: this.options.video_embed_caption || this.$t('interfaces-wysiwyg-modern-video_embed_caption_default')
        }
      })
    },
    EmbedBlockConfig () {
      return EmbedBlockConfig({
        options: {
          endpoint: this.options.embed_endpoint || '//noembed.com/embed?url=',
          placeholder: this.options.embed_placeholder || this.$t('interfaces-wysiwyg-modern-embed_placeholder_default')
        }
      })
    },
    DividerBlockConfig () {
      return DividerBlockConfig({})
    },
    enabledWidgets () {
      const widgets = [
        PlaceholderBlockConfig()
      ]

      if (this.options.upload_images) {
        widgets.push(this.ImageBlockConfig())
      }

      if (this.options.existing_images) {
        widgets.push(this.ExistingImageBlockConfig())
      }

      if (this.options.video_embed) {
        widgets.push(this.VideoBlockConfig())
      }

      if (this.options.embed) {
        widgets.push(this.EmbedBlockConfig())
      }

      if (this.options.divider) {
        widgets.push(this.DividerBlockConfig())
      }

      return widgets
    },

    // Dante 2 tooltips
    DanteImagePopoverConfig () {
      return DanteImagePopoverConfig()
    },
    DanteAnchorPopoverConfig () {
      return DanteAnchorPopoverConfig()
    },
    DanteInlineTooltipConfig () {
      return DanteInlineTooltipConfig()
    },
    DanteTooltipConfig () {
      const baseGroup = [
        {
          label: 'p',
          style: 'unstyled',
          icon: icons.bold
        }
      ]

      // Headings
      const headingsGroup = []

      if (this.options.buttons.includes('h1')) {
        headingsGroup.push({
          label: 'h1',
          style: 'header-one',
          type: 'block',
          icon: icons.h1
        })
      }

      if (this.options.buttons.includes('h2')) {
        headingsGroup.push({
          label: 'h2',
          style: 'header-two',
          type: 'block',
          icon: icons.h2
        })
      }

      if (this.options.buttons.includes('h3')) {
        headingsGroup.push({
          label: 'h3',
          style: 'header-three',
          type: 'block',
          icon: icons.h3
        })
      }

      if (this.options.buttons.includes('h4')) {
        headingsGroup.push({
          label: 'h4',
          style: 'header-four',
          type: 'block',
          icon: icons.h4()
        })
      }

      if (headingsGroup.length > 0) {
        headingsGroup.push({
          type: 'separator'
        })
      }

      // Elements
      const elementsGroup = []

      if (this.options.buttons.includes('color')) {
        elementsGroup.push({
          label: 'color',
          type: 'color'
        })
      }

      if (this.options.buttons.includes('anchor')) {
        elementsGroup.push({
          type: 'link'
        })
      }

      if (this.options.buttons.includes('quote')) {
        elementsGroup.push({
          label: 'blockquote',
          style: 'blockquote',
          type: 'block',
          icon: icons.blockquote
        })
      }

      if (elementsGroup.length > 0) {
        elementsGroup.push({
          type: 'separator'
        })
      }

      // Lists
      const listsGroup = []

      if (this.options.buttons.includes('orderedlist')) {
        listsGroup.push({
          label: 'insertorderedlist',
          style: 'ordered-list-item',
          type: 'block',
          icon: icons.insertorderedlist
        })
      }

      if (this.options.buttons.includes('unorderedlist')) {
        listsGroup.push({
          label: 'insertunorderedlist',
          style: 'unordered-list-item',
          type: 'block',
          icon: icons.insertunorderedlist
        })
      }

      if (listsGroup.length > 0) {
        listsGroup.push({
          type: 'separator'
        })
      }

      // Styles
      const stylesGroup = []

      if (this.options.buttons.includes('code')) {
        stylesGroup.push({
          label: 'code',
          style: 'code-block',
          type: 'block',
          icon: icons.code
        })
      }

      if (this.options.buttons.includes('bold')) {
        stylesGroup.push({
          label: 'bold',
          style: 'BOLD',
          type: 'inline',
          icon: icons.bold
        })
      }

      if (this.options.buttons.includes('italic')) {
        stylesGroup.push({
          label: 'italic',
          style: 'ITALIC',
          type: 'inline',
          icon: icons.italic
        })
      }

      return DanteTooltipConfig({
        widget_options: {
          placeholder: 'type a url',
          block_types: [
            ...baseGroup,
            ...headingsGroup,
            ...elementsGroup,
            ...listsGroup,
            ...stylesGroup
          ]
        }
      })
    },
    enabledTooltips () {
      return [
        this.DanteImagePopoverConfig(),
        this.DanteAnchorPopoverConfig(),
        this.DanteInlineTooltipConfig(),
        this.DanteTooltipConfig()
      ]
    },

    // Convert characters to blocks.
    characterConvertMapping () {
      const characterConvertMapping = {}

      if (this.options.character_mapping.includes('blockquote')) {
        characterConvertMapping['> '] = 'blockquote'
      }

      if (this.options.character_mapping.includes('unordered_list_item_1')) {
        characterConvertMapping['*.'] = 'unordered-list-item'
      }

      if (this.options.character_mapping.includes('unordered_list_item_2')) {
        characterConvertMapping['* '] = 'unordered-list-item'
      }

      if (this.options.character_mapping.includes('unordered_list_item_3')) {
        characterConvertMapping['- '] = 'unordered-list-item'
      }

      if (this.options.character_mapping.includes('ordered_list_item')) {
        characterConvertMapping['1.'] = 'ordered-list-item'
      }

      if (this.options.character_mapping.includes('unstyled')) {
        characterConvertMapping['=='] = 'unstyled'
      }

      if (this.options.character_mapping.includes('code_block')) {
        characterConvertMapping['` '] = 'code-block'
      }

      if (this.options.character_mapping.includes('header_one')) {
        characterConvertMapping['# '] = 'header-one'
      }

      if (this.options.character_mapping.includes('header_two')) {
        characterConvertMapping['#2'] = 'header-two'
      }

      if (this.options.character_mapping.includes('header_three')) {
        characterConvertMapping['#3'] = 'header-three'
      }

      if (this.options.character_mapping.includes('header_four')) {
        characterConvertMapping['#4'] = 'header-four'
      }

      return characterConvertMapping
    },

    // Methods
    async uploadImage (file) {
      try {
        let formData = new FormData()
        formData.append('image', file, file.fileName)

        const { data } = await this.$axios.post(`${this.$store.state.auth.url}/${this.$store.state.auth.project}/files`, formData, {
          headers: {
            Authorization: `Bearer ${this.$api.token}`
          }
        })

        let url = data.data.data.full_url
        if (this.options.custom_images_url) {
          url = `${this.options.custom_images_url}${data.data.filename}`
        }

        return url
      } catch (err) {
        throw err
      }
    },
    insertExistingImage (image) {
      this.$emit(EXISTING_IMAGE_INSERTION_EVENT, image)
    },
    onChange (editor) {
      this.$emit('input', editor.emitSerializedOutput())
    }
  }
}
</script>

<style lang="scss">
.interface-wysiwyg-modern-container {
  position: relative;
  width: 100%;
  max-width: var(--width-x-large);

  button.fullscreen-toggle {
    position: absolute;
    top: 10px;
    right: 10px;
    background-color: var(--white);
    color: var(--dark-gray);
    opacity: 0.4;
    border-radius: 100%;
    padding: 4px;
    z-index: 10;

    &:hover {
      opacity: 1;
    }
  }

  .interface-wysiwyg {
    position: relative;
    width: 100%;
    border: var(--input-border-width) solid var(--lighter-gray);
    border-radius: var(--border-radius);
    color: var(--gray);
    transition: var(--fast) var(--transition);
    transition-property: color, border-color, padding;
    font-weight: 400;
    line-height: 1.7em;
    overflow: unset;
    max-height: 950px;

    .dante-menu {
      z-index: 99;
    }

    .section-inner {
      min-height: 200px;
      max-height: 800px;
      overflow: scroll;
      padding: 12px 15px;
      padding-left: 50px;
    }

    .sketch-picker input {
      color: var(--darker-gray);
    }

    &:focus-within,
    &[focus-within] {
      color: var(--darker-gray);
      border-color: var(--darker-gray);
      outline: 0;
    }
  }

  &.readonly .interface-wysiwyg,
  &.readonly.fullscreen {
    background-color: var(--lightest-gray);
    cursor: not-allowed;
    &:focus {
      color: var(--gray);
    }

    .section-inner {
      padding-left: 15px;
    }
  }

  &.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    background-color: var(--body-background);
    border: 0;
    border-radius: 0;
    overflow: scroll;

    .section-inner {
      max-width: 100%;
      max-height: 100%;
      padding-left: 15px;
    }

    button.fullscreen-toggle {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 101;
      background-color: var(--darker-gray);
      color: var(--white);

      &:hover {
        background-color: var(--darkest-gray);
      }
    }

    .interface-wysiwyg {
      color: var(--dark-gray);

      border: none;
      border-radius: 0;
      padding: 80px 80px 100px 80px;
      max-width: 880px;
      margin: 0 auto;
      height: 100%;
      max-height: 100%;

      font-size: 21px;
      line-height: 33px;
      font-weight: 400;
    }
  }
}
</style>
