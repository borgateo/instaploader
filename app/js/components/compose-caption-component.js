import { h, Component } from 'preact';


export default class ComposeCaptionComponent extends Component {
  
  constructor(props) {
    super(props);
    this.state = { done: false };
  }

  _handleChange( e ) {
    var text = e.target.value;
    this.props.onChange( {caption: text} );
  }

  render() {
    return (
      <div>
        <label for="upload-textarea">Message</label>
        <textarea
          id="upload-textarea"
          onChange={this._handleChange.bind(this)}
        />
      </div>
    );
  }
}
