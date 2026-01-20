import config from '../../config/site.config'

const createFooterMarkup = () => {
  return {
    __html: config.footer,
  }
}

const Footer = () => {
  return (
    <div
      className="w-full border-t border-fluent-border p-6 text-center text-sm font-medium text-fluent-text-tertiary"
      dangerouslySetInnerHTML={createFooterMarkup()}
    ></div>
  )
}

export default Footer
