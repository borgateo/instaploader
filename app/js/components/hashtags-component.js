import { h, Component } from 'preact';

export default class HashtagsComponent extends Component {
  
  constructor(props) {
    super(props);
  }

  _handleChange( e ) {
    var text = e.target.value;
    this.props.onChange( {caption: text} );
  }

  render({hashtags}) {
    return (
      <div>
        <label for="upload-hashtags">#haghtags ({hashtags.length})</label>
        <textarea id="upload-hashtags" readonly>
          { hashtags.join(' ') }
        </textarea>
      </div>
    );
  }
}
